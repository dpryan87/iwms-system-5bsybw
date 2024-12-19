// @package typeorm v0.3.0
import { MigrationInterface, QueryRunner } from "typeorm";
import { LeaseStatus, EscalationType } from "../../core/leases/interfaces/lease.interface";

export class CreateLeases implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create leases table
        await queryRunner.query(`
            CREATE TABLE leases (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                property_id UUID NOT NULL,
                tenant_id UUID NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT '${LeaseStatus.DRAFT}',
                start_date TIMESTAMP WITH TIME ZONE NOT NULL,
                end_date TIMESTAMP WITH TIME ZONE NOT NULL,
                monthly_rent DECIMAL(12,2) NOT NULL,
                terms JSONB NOT NULL DEFAULT '{}',
                renewal_details JSONB NOT NULL DEFAULT '{}',
                audit_trail JSONB NOT NULL DEFAULT '{"changes": [], "reviews": []}',
                compliance_details JSONB NOT NULL DEFAULT '{}',
                billing_details JSONB NOT NULL DEFAULT '{}',
                notifications JSONB NOT NULL DEFAULT '[]',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                created_by UUID NOT NULL,
                updated_by UUID NOT NULL,
                version INTEGER NOT NULL DEFAULT 1,
                is_deleted BOOLEAN NOT NULL DEFAULT false,
                deleted_at TIMESTAMP WITH TIME ZONE,
                deleted_by UUID,
                CONSTRAINT fk_property FOREIGN KEY (property_id) REFERENCES properties(id),
                CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
                CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES users(id),
                CONSTRAINT fk_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
                CONSTRAINT fk_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id),
                CONSTRAINT chk_dates CHECK (end_date > start_date),
                CONSTRAINT chk_monthly_rent CHECK (monthly_rent >= 0),
                CONSTRAINT chk_status CHECK (status IN (
                    '${LeaseStatus.DRAFT}', '${LeaseStatus.ACTIVE}', '${LeaseStatus.PENDING_APPROVAL}',
                    '${LeaseStatus.PENDING_RENEWAL}', '${LeaseStatus.IN_RENEWAL_NEGOTIATION}',
                    '${LeaseStatus.RENEWED}', '${LeaseStatus.PENDING_TERMINATION}',
                    '${LeaseStatus.TERMINATED}', '${LeaseStatus.EXPIRED}',
                    '${LeaseStatus.IN_DISPUTE}', '${LeaseStatus.ON_HOLD}'
                ))
            );
        `);

        // Create lease_documents table
        await queryRunner.query(`
            CREATE TABLE lease_documents (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                lease_id UUID NOT NULL,
                file_name VARCHAR(255) NOT NULL,
                file_type VARCHAR(50) NOT NULL,
                storage_url TEXT NOT NULL,
                version VARCHAR(50) NOT NULL,
                status VARCHAR(50) NOT NULL,
                checksum VARCHAR(255) NOT NULL,
                metadata JSONB NOT NULL DEFAULT '{}',
                access_log JSONB NOT NULL DEFAULT '[]',
                upload_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                uploaded_by UUID NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                is_deleted BOOLEAN NOT NULL DEFAULT false,
                deleted_at TIMESTAMP WITH TIME ZONE,
                deleted_by UUID,
                CONSTRAINT fk_lease FOREIGN KEY (lease_id) REFERENCES leases(id) ON DELETE CASCADE,
                CONSTRAINT fk_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES users(id),
                CONSTRAINT fk_deleted_by FOREIGN KEY (deleted_by) REFERENCES users(id)
            );
        `);

        // Create indices for performance optimization
        await queryRunner.query(`
            CREATE INDEX idx_lease_status ON leases (status) WHERE is_deleted = false;
            CREATE INDEX idx_lease_dates ON leases (start_date, end_date) WHERE is_deleted = false;
            CREATE INDEX idx_lease_property ON leases (property_id) WHERE is_deleted = false;
            CREATE INDEX idx_lease_tenant ON leases (tenant_id) WHERE is_deleted = false;
            CREATE INDEX idx_lease_monthly_rent ON leases (monthly_rent) WHERE is_deleted = false;
            CREATE INDEX idx_lease_documents_lease ON lease_documents (lease_id) WHERE is_deleted = false;
            CREATE INDEX idx_lease_documents_status ON lease_documents (status) WHERE is_deleted = false;
            CREATE INDEX idx_lease_documents_version ON lease_documents (version) WHERE is_deleted = false;
        `);

        // Create GIN indices for JSONB columns
        await queryRunner.query(`
            CREATE INDEX idx_lease_terms_gin ON leases USING GIN (terms jsonb_path_ops);
            CREATE INDEX idx_lease_renewal_gin ON leases USING GIN (renewal_details jsonb_path_ops);
            CREATE INDEX idx_lease_document_metadata_gin ON lease_documents USING GIN (metadata jsonb_path_ops);
        `);

        // Create trigger for automatic timestamp updates
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION update_timestamp()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';

            CREATE TRIGGER update_leases_timestamp
                BEFORE UPDATE ON leases
                FOR EACH ROW
                EXECUTE FUNCTION update_timestamp();

            CREATE TRIGGER update_lease_documents_timestamp
                BEFORE UPDATE ON lease_documents
                FOR EACH ROW
                EXECUTE FUNCTION update_timestamp();
        `);

        // Create trigger for lease status audit logging
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION log_lease_status_change()
            RETURNS TRIGGER AS $$
            BEGIN
                IF NEW.status <> OLD.status THEN
                    NEW.audit_trail = jsonb_set(
                        NEW.audit_trail,
                        '{changes}',
                        (NEW.audit_trail->'changes') || jsonb_build_object(
                            'timestamp', CURRENT_TIMESTAMP,
                            'field', 'status',
                            'oldValue', OLD.status,
                            'newValue', NEW.status,
                            'userId', NEW.updated_by
                        )
                    );
                END IF;
                RETURN NEW;
            END;
            $$ language 'plpgsql';

            CREATE TRIGGER log_lease_status_changes
                BEFORE UPDATE OF status ON leases
                FOR EACH ROW
                EXECUTE FUNCTION log_lease_status_change();
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop triggers
        await queryRunner.query(`
            DROP TRIGGER IF EXISTS log_lease_status_changes ON leases;
            DROP TRIGGER IF EXISTS update_leases_timestamp ON leases;
            DROP TRIGGER IF EXISTS update_lease_documents_timestamp ON lease_documents;
            DROP FUNCTION IF EXISTS log_lease_status_change();
            DROP FUNCTION IF EXISTS update_timestamp();
        `);

        // Drop indices
        await queryRunner.query(`
            DROP INDEX IF EXISTS idx_lease_status;
            DROP INDEX IF EXISTS idx_lease_dates;
            DROP INDEX IF EXISTS idx_lease_property;
            DROP INDEX IF EXISTS idx_lease_tenant;
            DROP INDEX IF EXISTS idx_lease_monthly_rent;
            DROP INDEX IF EXISTS idx_lease_documents_lease;
            DROP INDEX IF EXISTS idx_lease_documents_status;
            DROP INDEX IF EXISTS idx_lease_documents_version;
            DROP INDEX IF EXISTS idx_lease_terms_gin;
            DROP INDEX IF EXISTS idx_lease_renewal_gin;
            DROP INDEX IF EXISTS idx_lease_document_metadata_gin;
        `);

        // Drop tables
        await queryRunner.query(`DROP TABLE IF EXISTS lease_documents;`);
        await queryRunner.query(`DROP TABLE IF EXISTS leases;`);
    }
}