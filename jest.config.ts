import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  clearMocks: true,
  roots: ['<rootDir>/tests/unit', '<rootDir>/tests/integration', '<rootDir>/tests/e2e'],
  testMatch: [
    '**/tests/unit/**/*.test.ts',
    '**/tests/integration/**/*.test.ts',
    '**/tests/e2e/**/*.spec.ts',
  ],
  collectCoverageFrom: [
    'src/modules/**/*.ts',
    'src/shared/**/*.ts',
    'src/middleware/**/*.ts',
    '!src/**/*.types.ts',
    '!src/**/*.schema.ts',
  ],
  coverageThreshold: {
    global: {
      lines: 80,
      branches: 75,
      functions: 80,
      statements: 80,
    },
  },
  coverageDirectory: 'coverage',
  moduleFileExtensions: ['ts', 'js', 'json'],
};

export default config;
