import type { Config } from '@jest/types';

/**
 * Jest configuration for IWMS Backend Service
 * Version: Jest 29.5.0
 * 
 * This configuration establishes a comprehensive test environment for the backend service
 * with support for TypeScript, code coverage requirements, and CI/CD integration.
 */
const jestConfig: Config.InitialOptions = {
  // Use ts-jest for TypeScript support
  preset: 'ts-jest',
  
  // Set Node.js as the test environment
  testEnvironment: 'node',
  
  // Define root directories for tests and source code
  roots: [
    '<rootDir>/src',
    '<rootDir>/tests'
  ],
  
  // Test file patterns to match
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx)',
    '**/?(*.)+(spec|test).+(ts|tsx)'
  ],
  
  // TypeScript transformation configuration
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  
  // Module path aliases mapping for clean imports
  moduleNameMapper: {
    '@/(.*)': '<rootDir>/src/$1',
    '@common/(.*)': '<rootDir>/src/common/$1',
    '@core/(.*)': '<rootDir>/src/core/$1',
    '@database/(.*)': '<rootDir>/src/database/$1',
    '@integrations/(.*)': '<rootDir>/src/integrations/$1',
    '@websocket/(.*)': '<rootDir>/src/websocket/$1',
    '@api-gateway/(.*)': '<rootDir>/src/api-gateway/$1',
    '@test-utils/(.*)': '<rootDir>/tests/utils/$1'
  },
  
  // Test setup and teardown configuration
  setupFilesAfterEnv: ['<rootDir>/tests/utils/test-setup.ts'],
  globalSetup: '<rootDir>/tests/utils/test-setup.ts',
  globalTeardown: '<rootDir>/tests/utils/test-setup.ts',
  
  // Code coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
    '/tests/',
    '/__mocks__/'
  ],
  
  // Test execution configuration
  testTimeout: 30000, // 30 second timeout
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/'
  ],
  
  // Supported file extensions
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json'
  ],
  
  // Performance optimization
  maxWorkers: '50%', // Use 50% of available CPU cores
  
  // Error handling and debugging
  errorOnDeprecated: true,
  detectOpenHandles: true,
  forceExit: true,
  
  // Notifications configuration
  notify: true,
  notifyMode: 'failure-change',
  
  // Watch mode plugins for better developer experience
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  
  // Test reporters for CI/CD integration
  reporters: [
    'default',
    'jest-junit'
  ]
};

export default jestConfig;