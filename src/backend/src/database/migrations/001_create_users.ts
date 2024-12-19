// @package knex v2.5.1
import { Knex } from 'knex';
import { UserRole } from '../../core/users/interfaces/user.interface';

/**
 * Migration: Create users table with enhanced security features
 * Implements role-based access control and comprehensive audit capabilities
 * Aligned with ISO 27001 and GDPR requirements
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

  await knex.transaction(async (trx) => {
    // Create updated_at trigger function
    await trx.raw(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Create users table with enhanced security features
    await trx.schema.createTable('users', (table) => {
      // Primary identification
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'))
        .notNullable()
        .comment('Unique identifier for the user');

      // Authentication fields
      table.string('email', 255).unique().notNullable()
        .checkRegex(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/)
        .comment('User email address - must be unique and valid format');
      
      table.string('password_hash', 255).notNullable()
        .comment('Bcrypt hashed password - minimum 60 characters');

      // Profile information
      table.string('first_name', 100).notNullable()
        .checkPositive()
        .comment('User first name');
      
      table.string('last_name', 100).notNullable()
        .checkPositive()
        .comment('User last name');

      // Role and permissions
      table.enum('role', [
        UserRole.SYSTEM_ADMIN,
        UserRole.FACILITY_MANAGER,
        UserRole.SPACE_PLANNER,
        UserRole.BU_ADMIN
      ]).notNullable()
        .comment('User role for RBAC');

      table.jsonb('permissions').notNullable().defaultTo('[]')
        .comment('Array of specific permissions granted to user');

      // Security and status
      table.timestamp('last_login', { useTz: true })
        .comment('Timestamp of last successful login');
      
      table.boolean('is_active').notNullable().defaultTo(true)
        .comment('User account status flag');

      table.integer('failed_login_attempts').notNullable().defaultTo(0)
        .comment('Count of consecutive failed login attempts');

      table.timestamp('password_last_changed', { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())
        .comment('Timestamp of last password change');

      // Audit fields
      table.timestamp('created_at', { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())
        .comment('Timestamp of record creation');
      
      table.timestamp('updated_at', { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())
        .comment('Timestamp of last record update');

      table.uuid('created_by')
        .comment('User ID who created this record');
      
      table.uuid('updated_by')
        .comment('User ID who last updated this record');

      // Security preferences
      table.boolean('mfa_enabled').notNullable().defaultTo(false)
        .comment('Multi-factor authentication status');
      
      table.string('mfa_method', 20)
        .comment('Selected MFA method (APP/SMS/EMAIL)');

      // Additional metadata
      table.jsonb('metadata').defaultTo('{}')
        .comment('Additional user metadata and preferences');
    });

    // Create optimized indexes
    await trx.raw(`
      CREATE UNIQUE INDEX users_email_idx ON users (LOWER(email));
      CREATE INDEX users_role_idx ON users (role);
      CREATE INDEX users_active_role_idx ON users (role, is_active) WHERE is_active = true;
      CREATE INDEX users_last_login_idx ON users (last_login) WHERE last_login IS NOT NULL;
      CREATE INDEX users_password_last_changed_idx ON users (password_last_changed);
    `);

    // Create updated_at trigger
    await trx.raw(`
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // Add table comments
    await trx.raw(`
      COMMENT ON TABLE users IS 'User accounts with enhanced security and RBAC capabilities';
    `);
  });
}

/**
 * Rollback: Drop users table and related objects
 * Ensures clean removal of all created database objects
 */
export async function down(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    // Drop triggers
    await trx.raw('DROP TRIGGER IF EXISTS update_users_updated_at ON users');
    await trx.raw('DROP FUNCTION IF EXISTS update_updated_at_column');

    // Drop table with cascading constraints
    await trx.schema.dropTableIfExists('users');
  });
}