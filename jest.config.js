/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/*.test.ts'],
  clearMocks: true,
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/ios/',
    '/android/',
  ],
  modulePathIgnorePatterns: ['/node_modules/', '/dist/', '/ios/', '/android/'],
  watchPathIgnorePatterns: ['/node_modules/', '/dist/', '/ios/', '/android/'],
  watchman: false,
  maxWorkers: 1,
  moduleNameMapper: {
    '^react-native-mmkv$': '<rootDir>/__mocks__/react-native-mmkv.ts',
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
}
