/**
 * Jest Configuration
 * 
 * This configuration sets up Jest for unit and integration testing,
 * with TypeScript support, path mapping, and code coverage.
 */
import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import { compilerOptions } from './tsconfig.json';

const config: Config = {
  // Basic configuration
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/tests/**/*.spec.ts',
    '**/__tests__/**/*.ts'
  ],
  
  // Module resolution
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths || {}, { prefix: '<rootDir>/' }),
  
  // Transform files
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  
  // Test coverage
  collectCoverage: true,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'server/**/*.ts',
    'shared/**/*.ts',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/*.test.ts',
    '!**/*.spec.ts',
    '!**/*.d.ts'
  ],
  coverageReporters: ['text', 'lcov', 'clover', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    },
  },
  
  // Performance
  maxWorkers: '50%',
  
  // Timeouts
  testTimeout: 10000,
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts'
  ],
  
  // Global variables
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
  
  // Other options
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
};

export default config;