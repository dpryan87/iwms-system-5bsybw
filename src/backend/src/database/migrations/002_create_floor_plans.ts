// @package typeorm v0.3.0
import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';
import { FloorPlanStatus } from '../../core/floor-plans/interfaces/floor-plan.interface';

/**
 * Migration to create the floor_plans table with all necessary columns, indices,
 * and relationships for managing floor plan data in the IWMS system.
 * 
 * This migration handles:
 * - Floor plan metadata storage
 * - Version control tracking
 * - Status management
 * - Property relationships
 * - Audit timestamps
 */
export class CreateFloorPlans1234567890 implements MigrationInterface {
    /**
     * Executes the migration to create the floor_plans table and related structures
     * @param queryRunner TypeORM query runner for executing database operations
     */
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create floor_plans table
        await queryRunner.createTable(
            new Table({
                name: 'floor_plans',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        default: 'uuid_generate_v4()',
                        comment: 'Unique identifier for the floor plan'
                    },
                    {
                        name: 'property_id',
                        type: 'uuid',
                        isNullable: false,
                        comment: 'Reference to the parent property'
                    },
                    {
                        name: 'version',
                        type: 'varchar',
                        length: '50',
                        isNullable: false,
                        comment: 'Semantic version of the floor plan'
                    },
                    {
                        name: 'status',
                        type: 'enum',
                        enum: [
                            FloorPlanStatus.DRAFT,
                            FloorPlanStatus.PUBLISHED,
                            FloorPlanStatus.ARCHIVED
                        ],
                        default: `'${FloorPlanStatus.DRAFT}'`,
                        isNullable: false,
                        comment: 'Current status of the floor plan'
                    },
                    {
                        name: 'metadata',
                        type: 'jsonb',
                        isNullable: false,
                        comment: 'JSON metadata including dimensions, file info, and custom attributes'
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp with time zone',
                        default: 'CURRENT_TIMESTAMP',
                        isNullable: false,
                        comment: 'Timestamp of floor plan creation'
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamp with time zone',
                        default: 'CURRENT_TIMESTAMP',
                        isNullable: false,
                        comment: 'Timestamp of last floor plan update'
                    }
                ],
                indices: [
                    {
                        name: 'PK_FLOOR_PLANS',
                        columnNames: ['id']
                    }
                ]
            }),
            true
        );

        // Create index for property_id foreign key
        await queryRunner.createIndex(
            'floor_plans',
            new TableIndex({
                name: 'IDX_FLOOR_PLANS_PROPERTY',
                columnNames: ['property_id'],
                isUnique: false
            })
        );

        // Create index for status queries
        await queryRunner.createIndex(
            'floor_plans',
            new TableIndex({
                name: 'IDX_FLOOR_PLANS_STATUS',
                columnNames: ['status'],
                isUnique: false
            })
        );

        // Create index for version queries
        await queryRunner.createIndex(
            'floor_plans',
            new TableIndex({
                name: 'IDX_FLOOR_PLANS_VERSION',
                columnNames: ['version'],
                isUnique: false
            })
        );

        // Create foreign key to properties table
        await queryRunner.createForeignKey(
            'floor_plans',
            new TableForeignKey({
                name: 'FK_FLOOR_PLANS_PROPERTY',
                columnNames: ['property_id'],
                referencedTableName: 'properties',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE'
            })
        );

        // Create trigger for updated_at timestamp
        await queryRunner.query(`
            CREATE TRIGGER update_floor_plans_timestamp
            BEFORE UPDATE ON floor_plans
            FOR EACH ROW
            EXECUTE FUNCTION update_timestamp();
        `);

        // Add table comment
        await queryRunner.query(`
            COMMENT ON TABLE floor_plans IS 'Stores floor plan data with version control and property relationships';
        `);
    }

    /**
     * Reverts the migration by dropping the floor_plans table and related structures
     * @param queryRunner TypeORM query runner for executing database operations
     */
    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop trigger
        await queryRunner.query(`DROP TRIGGER IF EXISTS update_floor_plans_timestamp ON floor_plans;`);

        // Drop foreign key
        await queryRunner.dropForeignKey('floor_plans', 'FK_FLOOR_PLANS_PROPERTY');

        // Drop indices
        await queryRunner.dropIndex('floor_plans', 'IDX_FLOOR_PLANS_VERSION');
        await queryRunner.dropIndex('floor_plans', 'IDX_FLOOR_PLANS_STATUS');
        await queryRunner.dropIndex('floor_plans', 'IDX_FLOOR_PLANS_PROPERTY');

        // Drop table
        await queryRunner.dropTable('floor_plans', true, true, true);

        // Drop enum type if exists
        await queryRunner.query(`DROP TYPE IF EXISTS floor_plan_status;`);
    }
}