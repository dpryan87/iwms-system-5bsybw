// @package typeorm v0.3.0
import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';
import { ResourceType, ResourceStatus } from '../../core/resources/interfaces/resource.interface';

/**
 * Migration class for creating the resources table with comprehensive tracking capabilities
 * Implements enhanced indexing, constraints and extensible attribute storage
 */
export class CreateResources1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create resource_type enum
    await queryRunner.query(`
      CREATE TYPE resource_type AS ENUM (
        'WORKSTATION',
        'MEETING_ROOM',
        'SHARED_SPACE',
        'AMENITY'
      )
    `);

    // Create resource_status enum
    await queryRunner.query(`
      CREATE TYPE resource_status AS ENUM (
        'AVAILABLE',
        'OCCUPIED',
        'MAINTENANCE',
        'RESERVED'
      )
    `);

    // Create resources table with comprehensive structure
    await queryRunner.createTable(
      new Table({
        name: 'resources',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'resource_type',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'resource_status',
            isNullable: false,
            default: "'AVAILABLE'",
          },
          {
            name: 'capacity',
            type: 'integer',
            isNullable: false,
            default: 1,
          },
          {
            name: 'attributes',
            type: 'jsonb',
            isNullable: false,
            comment: 'Stores enhanced resource metadata including name, description, equipment list, location, dimensions, accessibility features, and custom fields',
          },
          {
            name: 'space_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Create optimized indices for common queries
    await queryRunner.createIndex(
      'resources',
      new TableIndex({
        name: 'IDX_RESOURCES_SPACE',
        columnNames: ['space_id'],
      })
    );

    await queryRunner.createIndex(
      'resources',
      new TableIndex({
        name: 'IDX_RESOURCES_TYPE',
        columnNames: ['type'],
      })
    );

    await queryRunner.createIndex(
      'resources',
      new TableIndex({
        name: 'IDX_RESOURCES_STATUS',
        columnNames: ['status'],
      })
    );

    // Create composite index for optimized filtering
    await queryRunner.createIndex(
      'resources',
      new TableIndex({
        name: 'IDX_RESOURCES_COMPOSITE',
        columnNames: ['space_id', 'type', 'status'],
      })
    );

    // Create GIN index for JSONB attributes
    await queryRunner.createIndex(
      'resources',
      new TableIndex({
        name: 'IDX_RESOURCES_ATTRIBUTES',
        columnNames: ['attributes'],
        isUnique: false,
        using: 'GIN',
      })
    );

    // Add foreign key constraint
    await queryRunner.createForeignKey(
      'resources',
      new TableForeignKey({
        name: 'FK_RESOURCES_SPACE',
        columnNames: ['space_id'],
        referencedTableName: 'spaces',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      })
    );

    // Add check constraint for capacity
    await queryRunner.query(`
      ALTER TABLE resources
      ADD CONSTRAINT CHK_RESOURCES_CAPACITY
      CHECK (capacity > 0)
    `);

    // Create trigger for updated_at
    await queryRunner.query(`
      CREATE TRIGGER update_resources_timestamp
      BEFORE UPDATE ON resources
      FOR EACH ROW
      EXECUTE FUNCTION update_timestamp();
    `);

    // Add validation for attributes JSONB structure
    await queryRunner.query(`
      ALTER TABLE resources
      ADD CONSTRAINT CHK_RESOURCES_ATTRIBUTES_STRUCTURE
      CHECK (
        jsonb_typeof(attributes) = 'object' AND
        attributes ? 'name' AND
        attributes ? 'description' AND
        attributes ? 'equipment'
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all constraints
    await queryRunner.query('ALTER TABLE resources DROP CONSTRAINT IF EXISTS CHK_RESOURCES_ATTRIBUTES_STRUCTURE');
    await queryRunner.query('ALTER TABLE resources DROP CONSTRAINT IF EXISTS CHK_RESOURCES_CAPACITY');
    
    // Drop trigger
    await queryRunner.query('DROP TRIGGER IF EXISTS update_resources_timestamp ON resources');
    
    // Drop indices
    await queryRunner.dropIndex('resources', 'IDX_RESOURCES_ATTRIBUTES');
    await queryRunner.dropIndex('resources', 'IDX_RESOURCES_COMPOSITE');
    await queryRunner.dropIndex('resources', 'IDX_RESOURCES_STATUS');
    await queryRunner.dropIndex('resources', 'IDX_RESOURCES_TYPE');
    await queryRunner.dropIndex('resources', 'IDX_RESOURCES_SPACE');
    
    // Drop foreign key
    await queryRunner.dropForeignKey('resources', 'FK_RESOURCES_SPACE');
    
    // Drop table
    await queryRunner.dropTable('resources');
    
    // Drop enums
    await queryRunner.query('DROP TYPE IF EXISTS resource_status');
    await queryRunner.query('DROP TYPE IF EXISTS resource_type');
  }
}