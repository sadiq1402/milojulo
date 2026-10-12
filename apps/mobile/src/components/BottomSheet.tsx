import React, { useEffect, useRef, type ReactNode } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, radius, shadow, sizes } from '../theme';

type Props = { visible: boolean; onClose: () => void; children: ReactNode };

export function BottomSheet({ visible, onClose, children }: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const offset = useRef(new Animated.Value(height)).current;

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
      <View style={styles.root}>
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
            {
              maxHeight: (height * sizes.sheet.maxHeightPct) / 100,
              paddingBottom: sizes.sheet.paddingTop + insets.bottom,
              transform: [{ translateY: offset }],
            },
          ]}
        >
          <View style={styles.handle} />
          {children}
        </Animated.View>
      </View>
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
