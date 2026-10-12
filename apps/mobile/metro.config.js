const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  // Design tokens live at the repo root, shared with the admin page.
  watchFolders: [path.resolve(__dirname, '../../design')],
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
