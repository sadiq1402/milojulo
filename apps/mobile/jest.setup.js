// The library's hooks are jest.fn, which resetMocks would empty; keep their implementations as plain functions.
jest.mock('react-native-safe-area-context', () => {
  const mock = require('react-native-safe-area-context/jest/mock').default;
  return {
    ...mock,
    useSafeAreaInsets: mock.useSafeAreaInsets.getMockImplementation(),
    useSafeAreaFrame: mock.useSafeAreaFrame.getMockImplementation(),
  };
});

// Unit tests never reach Supabase; they mock the feature data modules instead.
jest.mock('./src/lib/supabase', () => ({ supabase: {} }));
