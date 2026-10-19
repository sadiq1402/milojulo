import React, { useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, radius, shadow, sizes } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  // Always at its full height, so a list filtered while it's open doesn't make it jump.
  full?: boolean;
  children: ReactNode;
};

export function BottomSheet({
  visible,
  onClose,
  full = false,
  children,
}: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const offset = useRef(new Animated.Value(height)).current;
  const tallest = (height * sizes.sheet.maxHeightPct) / 100;
  // A Modal on Android doesn't resize for the keyboard, so make room under the sheet ourselves.
  // The sheet already pads for the bottom inset, which the keyboard covers.
  const keyboard = useReanimatedKeyboardAnimation();
  const keyboardRoom = useAnimatedStyle(() => ({
    paddingBottom: Math.max(-keyboard.height.value - insets.bottom, 0),
  }));

  useEffect(() => {
    if (visible) {
      offset.setValue(height);
      Animated.spring(offset, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
      }).start();
    }
  }, [visible, height, offset]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Reanimated.View
        style={[styles.root, { paddingTop: insets.top }, keyboardRoom]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            full ? { height: tallest } : { maxHeight: tallest },
            {
              paddingBottom: sizes.sheet.paddingTop + insets.bottom,
              transform: [{ translateY: offset }],
            },
          ]}
        >
          <View style={styles.handle} />
          {children}
        </Animated.View>
      </Reanimated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.r28,
    borderTopRightRadius: radius.r28,
    paddingTop: sizes.sheet.paddingTop,
    paddingHorizontal: sizes.sheet.paddingX,
    gap: layout.blockGap,
    // Gives way to the keyboard: content that needs more room scrolls.
    flexShrink: 1,
    ...shadow('sheet'),
  },
  handle: {
    width: sizes.sheet.handle.w,
    height: sizes.sheet.handle.h,
    borderRadius: sizes.sheet.handle.h,
    backgroundColor: colors.handle,
    alignSelf: 'center',
  },
});
