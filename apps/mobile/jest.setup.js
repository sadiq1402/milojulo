// The library's hooks are jest.fn, which resetMocks would empty; keep their implementations as plain functions.
jest.mock('react-native-safe-area-context', () => {
  const mock = require('react-native-safe-area-context/jest/mock').default;
  return {
    ...mock,
    useSafeAreaInsets: mock.useSafeAreaInsets.getMockImplementation(),
    useSafeAreaFrame: mock.useSafeAreaFrame.getMockImplementation(),
  };
});

// The native photo picker doesn't exist under Jest; tests say what it returns.
jest.mock('react-native-image-crop-picker', () => ({
  __esModule: true,
  default: { openPicker: jest.fn(), openCamera: jest.fn() },
}));

// Chat media natives (#45): compression, voice record/play and video playback.
jest.mock('react-native-compressor', () => ({
  __esModule: true,
  Video: { compress: jest.fn() },
  getVideoMetaData: jest.fn(),
}));
jest.mock('react-native-nitro-sound', () => ({
  __esModule: true,
  OutputFormatAndroidType: { MPEG_4: 2 },
  AudioEncoderAndroidType: { AAC: 3 },
  default: {
    startRecorder: jest.fn(),
    stopRecorder: jest.fn(),
    addRecordBackListener: jest.fn(),
    removeRecordBackListener: jest.fn(),
    startPlayer: jest.fn(),
    stopPlayer: jest.fn(),
    addPlayBackListener: jest.fn(),
    removePlayBackListener: jest.fn(),
    addPlaybackEndListener: jest.fn(),
    removePlaybackEndListener: jest.fn(),
  },
}));
jest.mock('react-native-video', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View };
});

// Unit tests never reach Supabase; they mock the feature data modules instead.
jest.mock('./src/lib/supabase', () => ({ supabase: {} }));

// React Native's mock is a jest.fn that resetMocks would empty between tests.
require('react-native').AppState.addEventListener = () => ({
  remove: () => {},
});

// Same for AccessibilityInfo. Reduce motion is on, so the BrandLoader stands still and hands over
// at once; tests of its animation turn it off.
const { AccessibilityInfo } = require('react-native');
AccessibilityInfo.isReduceMotionEnabled = () => Promise.resolve(true);
AccessibilityInfo.addEventListener = () => ({ remove: () => {} });

// The native animation module is a stub that never reports a mounted view's animation finished,
// so run timing animations on the JS driver, whose frames run on real timers here (wrap waits for
// them in act).
const { Animated } = require('react-native');
const timing = Animated.timing;
Animated.timing = (value, config) =>
  timing(value, { ...config, useNativeDriver: false });

// FlatList renders rows in timed batches, which land mid-test as unwrapped updates. Unit tests
// check what is shown, not virtualisation, so render every row at once instead.
jest.mock('react-native/Libraries/Lists/FlatList', () => {
  const React = require('react');
  const { ScrollView, View } = require('react-native');
  const element = Component =>
    !Component ? null : React.isValidElement(Component) ? (
      Component
    ) : (
      <Component />
    );
  function FlatList({
    data,
    renderItem,
    keyExtractor,
    ListHeaderComponent,
    ListFooterComponent,
    ListEmptyComponent,
    ...rest
  }) {
    // Other props (testID, onEndReached, refreshControl) reach the ScrollView, so tests can fire them.
    return (
      <ScrollView {...rest}>
        {element(ListHeaderComponent)}
        {!data?.length && element(ListEmptyComponent)}
        {(data ?? []).map((item, index) => (
          <View key={keyExtractor ? keyExtractor(item, index) : index}>
            {renderItem({ item, index })}
          </View>
        ))}
        {element(ListFooterComponent)}
      </ScrollView>
    );
  }
  return { __esModule: true, default: FlatList };
});
