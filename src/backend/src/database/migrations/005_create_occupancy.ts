/**
 * @fileoverview Migration to create occupancy_data table with TimescaleDB support
 * @version 1.0.0
 * @package @database/migrations
 */

import { MigrationInterface, QueryRunner } from 'typeorm'; // v0.3.x
import { IOccupancyData } from '../../core/occupancy/interfaces/occupancy.interface';

/**
 * Constants for TimescaleDB configuration
 */
const TABLE_NAME = 'occupancy_data';
const TIME_COLUMN = 'timestamp';
const CHUNK_INTERVAL = '1 day::interval';
const RETENTION_PERIOD = '12 months::interval';
const COMPRESSION_AFTER = '7 days::interval';

export class CreateOccupancyTable implements MigrationInterface {
    name = '005-create-occupancy-table';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create base table
        await queryRunner.query(`
            CREATE TABLE ${TABLE_NAME} (
                id UUID DEFAULT gen_random_uuid(),
                space_id UUID NOT NULL,
                timestamp TIMESTAMPTZ NOT NULL,
                occupant_count INTEGER NOT NULL,
                capacity INTEGER NOT NULL,
                utilization_rate DECIMAL(5,2) NOT NULL,
                source VARCHAR(50) NOT NULL,
                sensor_metadata JSONB NOT NULL DEFAULT '{}',
                is_validated BOOLEAN DEFAULT false,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

                -- Constraints
                CONSTRAINT pk_${TABLE_NAME} PRIMARY KEY (id, timestamp),
                CONSTRAINT fk_${TABLE_NAME}_space FOREIGN KEY (space_id) 
                    REFERENCES spaces(id) ON DELETE CASCADE,
                CONSTRAINT chk_${TABLE_NAME}_occupant_count 
                    CHECK (occupant_count >= 0),
                CONSTRAINT chk_${TABLE_NAME}_capacity 
                    CHECK (capacity > 0),
                CONSTRAINT chk_${TABLE_NAME}_utilization 
                    CHECK (utilization_rate >= 0 AND utilization_rate <= 100)
            );
        `);

        // Create indexes
        await queryRunner.query(`
            CREATE INDEX idx_${TABLE_NAME}_space_time 
                ON ${TABLE_NAME}(space_id, timestamp DESC);
            
            CREATE INDEX idx_${TABLE_NAME}_recent 
                ON ${TABLE_NAME}(timestamp DESC) 
                WHERE timestamp > NOW() - INTERVAL '7 days';
        `);

        // Convert to hypertable
        await queryRunner.query(`
            SELECT create_hypertable(
                '${TABLE_NAME}', 
                '${TIME_COLUMN}',
                chunk_time_interval => ${CHUNK_INTERVAL}
            );
        `);

        // Configure compression
        await queryRunner.query(`
            ALTER TABLE ${TABLE_NAME} SET (
                timescaledb.compress,
                timescaledb.compress_segmentby = 'space_id',
                timescaledb.compress_orderby = 'timestamp DESC'
            );

            SELECT add_compression_policy(
                '${TABLE_NAME}', 
                ${COMPRESSION_AFTER}
            );
        `);

        // Create continuous aggregates for hourly data
        await queryRunner.query(`
            CREATE MATERIALIZED VIEW ${TABLE_NAME}_hourly
            WITH (timescaledb.continuous) AS
            SELECT 
                space_id,
                time_bucket('1 hour', timestamp) AS bucket,
                AVG(occupant_count)::INTEGER as avg_occupant_count,
                MAX(occupant_count) as max_occupant_count,
                MIN(occupant_count) as min_occupant_count,
                AVG(utilization_rate)::DECIMAL(5,2) as avg_utilization_rate,
                COUNT(*) as sample_count
            FROM ${TABLE_NAME}
            GROUP BY space_id, bucket
            WITH NO DATA;

            SELECT add_continuous_aggregate_policy(
                '${TABLE_NAME}_hourly',
                start_offset => INTERVAL '1 month',
                end_offset => INTERVAL '1 hour',
                schedule_interval => INTERVAL '1 hour'
            );
        `);

        // Create continuous aggregates for daily data
        await queryRunner.query(`
            CREATE MATERIALIZED VIEW ${TABLE_NAME}_daily
            WITH (timescaledb.continuous) AS
            SELECT 
                space_id,
                time_bucket('1 day', timestamp) AS bucket,
                AVG(occupant_count)::INTEGER as avg_occupant_count,
                MAX(occupant_count) as max_occupant_count,
                MIN(occupant_count) as min_occupant_count,
                AVG(utilization_rate)::DECIMAL(5,2) as avg_utilization_rate,
                COUNT(*) as sample_count
            FROM ${TABLE_NAME}
            GROUP BY space_id, bucket
            WITH NO DATA;

            SELECT add_continuous_aggregate_policy(
                '${TABLE_NAME}_daily',
                start_offset => INTERVAL '12 months',
                end_offset => INTERVAL '1 day',
                schedule_interval => INTERVAL '1 day'
            );
        `);

        // Set retention policy
        await queryRunner.query(`
            SELECT add_retention_policy(
                '${TABLE_NAME}', 
                ${RETENTION_PERIOD}
            );
        `);

        // Create trigger for automatic utilization rate calculation
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION calculate_utilization_rate()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.utilization_rate = 
                    CASE 
                        WHEN NEW.capacity > 0 
                        THEN (NEW.occupant_count::DECIMAL / NEW.capacity * 100)::DECIMAL(5,2)
                        ELSE 0
                    END;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER trg_${TABLE_NAME}_utilization
            BEFORE INSERT OR UPDATE ON ${TABLE_NAME}
            FOR EACH ROW
            EXECUTE FUNCTION calculate_utilization_rate();
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop continuous aggregates
        await queryRunner.query(`
            DROP MATERIALIZED VIEW IF EXISTS ${TABLE_NAME}_hourly CASCADE;
            DROP MATERIALIZED VIEW IF EXISTS ${TABLE_NAME}_daily CASCADE;
        `);

        // Remove compression policy
        await queryRunner.query(`
            SELECT remove_compression_policy('${TABLE_NAME}', if_exists => true);
            ALTER TABLE ${TABLE_NAME} SET (timescaledb.compress = false);
        `);

        // Remove retention policy
        await queryRunner.query(`
            SELECT remove_retention_policy('${TABLE_NAME}', if_exists => true);
        `);

        // Drop trigger and function
        await queryRunner.query(`
            DROP TRIGGER IF EXISTS trg_${TABLE_NAME}_utilization ON ${TABLE_NAME};
            DROP FUNCTION IF EXISTS calculate_utilization_rate();
        `);

        // Drop indexes
        await queryRunner.query(`
            DROP INDEX IF EXISTS idx_${TABLE_NAME}_space_time;
            DROP INDEX IF EXISTS idx_${TABLE_NAME}_recent;
        `);

        // Drop table (this will automatically drop the hypertable)
        await queryRunner.query(`DROP TABLE IF EXISTS ${TABLE_NAME} CASCADE;`);
    }
}