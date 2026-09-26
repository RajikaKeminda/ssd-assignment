import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      { diagnostics: false },
    ],
  },
  collectCoverageFrom: [
    'src/services/order.service.ts',
    'src/controllers/order.controller.ts',
    'src/routes/order.routes.ts',
    'src/services/request.service.ts',
    'src/controllers/request.controller.ts',
    'src/routes/request.routes.ts',
    'src/services/inventory.service.ts',
    'src/controllers/inventory.controller.ts',
    'src/routes/inventory.routes.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'clover'],
  setupFilesAfterEnv: [],
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  testTimeout: 30000,
};

export default config;
