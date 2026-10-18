module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.afterEnv.js'],
  // Room for several 5 s waits in one test (see jest.afterEnv.js).
  testTimeout: 20000,
  resetMocks: true,
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/test/memoryStorage.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-svg|react-native-screens|react-native-safe-area-context|@react-native-async-storage)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/__integration__/'],
};
