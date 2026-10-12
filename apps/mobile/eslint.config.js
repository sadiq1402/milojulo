const reactNativeConfig = require('@react-native/eslint-config/flat');

// Flat config here also stops ESLint searching parent folders for another project's config.
module.exports = [
  { ignores: ['android/', 'ios/', 'src/lib/database.types.ts'] },
  ...reactNativeConfig,
  {
    files: ['jest.setup.js', 'jest.afterEnv.js'],
    languageOptions: { globals: { jest: 'readonly', afterEach: 'readonly' } },
  },
];
