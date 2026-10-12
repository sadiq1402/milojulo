module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  resetMocks: true,
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation|react-native-svg|react-native-screens|react-native-safe-area-context|@react-native-async-storage)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/__integration__/'],
};
