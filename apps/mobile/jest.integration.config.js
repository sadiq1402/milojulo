// Data modules against the local Supabase stack (`npx supabase start` at the repo root).
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__integration__'],
  globalSetup: '<rootDir>/__integration__/support/globalSetup.js',
  setupFiles: ['<rootDir>/__integration__/support/hermes.ts'],
  setupFilesAfterEnv: ['<rootDir>/__integration__/support/afterEnv.ts'],
  moduleNameMapper: {
    '^react-native$': '<rootDir>/__integration__/support/reactNative.ts',
    '^react-native-url-polyfill/auto$':
      '<rootDir>/__integration__/support/empty.ts',
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/test/memoryStorage.ts',
    '/config/env$': '<rootDir>/__integration__/support/env.ts',
    '^@react-native-firebase/messaging$':
      '<rootDir>/__integration__/support/messaging.ts',
  },
};
