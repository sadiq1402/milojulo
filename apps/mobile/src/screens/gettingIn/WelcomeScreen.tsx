import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Image, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { brandMark, markAspectRatio } from '../../assets/brand';
import { Button, Text } from '../../components';
import type { SignedOutParams } from '../../navigation/types';
import {
  colors,
  fontFamily,
  fonts,
  layout,
  radius,
  sizes,
  spacing,
  textStyles,
} from '../../theme';

const stickers = [
  { label: 'Friends', bg: colors.butter, fg: colors.ink, tilt: '-4deg' },
  { label: 'Activities', bg: colors.white, fg: colors.orchid, tilt: '3deg' },
  { label: 'Dating', bg: colors.lilac, fg: colors.ink, tilt: '-2deg' },
  {
    label: 'Networking',
    bg: colors.tintStrong,
    fg: colors.orchidDark,
    tilt: '4deg',
  },
];

export function WelcomeScreen({
  navigation,
}: NativeStackScreenProps<SignedOutParams, 'Welcome'>) {
  const focused = useIsFocused();
  return (
    <View testID="welcome-screen" style={styles.screen}>
      {focused ? <StatusBar barStyle="light-content" /> : null}
      <View testID="welcome-pink-blob" style={styles.pinkBlob} />
      <View testID="welcome-lilac-blob" style={styles.lilacBlob} />
      <View testID="welcome-butter-dot" style={styles.butterDot} />
      <SafeAreaView edges={['top', 'bottom']} style={styles.fill}>
        <View style={styles.content}>
          <View
            style={styles.header}
            accessible
            accessibilityRole="header"
            accessibilityLabel="MiloJulo"
          >
            <Image
              testID="welcome-mark"
              source={brandMark}
              style={styles.mark}
              resizeMode="contain"
            />
            <Text variant="h1">
              <Text style={textStyles.h1} color={colors.white}>
                Milo
              </Text>
              <Text style={textStyles.h1} color={colors.butter}>
                Julo
              </Text>
            </Text>
          </View>
          <View style={styles.fill} />
          <View
            style={styles.stickers}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {stickers.map(s => (
              <View
                key={s.label}
                style={[
                  styles.sticker,
                  { backgroundColor: s.bg, transform: [{ rotate: s.tilt }] },
                ]}
              >
                <Text
                  variant="bodySmall"
                  color={s.fg}
                  style={styles.stickerLabel}
                >
                  {s.label}
                </Text>
              </View>
            ))}
          </View>
          <Text variant="display" color={colors.white}>
            Meet people in Pune who want the same kind of hangout.
          </Text>
          <Text color={colors.white}>
            Friends, activities and more, with people who want the same thing.
          </Text>
          <View style={styles.actions}>
            <Button
              label="Get started"
              variant="inverse"
              onPress={() => navigation.navigate('Email')}
            />
            <Text
              variant="bodySmall"
              color={colors.white}
              style={styles.centred}
            >
              Now open in Pune.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.orchid, overflow: 'hidden' },
  fill: { flex: 1 },
  header: { gap: spacing.sm },
  mark: { width: 112, aspectRatio: markAspectRatio },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: layout.sectionGap,
  },
  stickers: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.chip.gap },
  sticker: {
    height: sizes.chip.height,
    paddingHorizontal: sizes.chip.paddingX,
    borderRadius: radius.r20,
    justifyContent: 'center',
  },
  stickerLabel: { fontFamily: fontFamily(fonts.text, '700') },
  actions: { gap: spacing.sm },
  centred: { textAlign: 'center' },
  // Decoration from the mockup (390-wide frame).
  pinkBlob: {
    position: 'absolute',
    right: -120,
    top: -80,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: colors.tintStrong,
    opacity: 0.38,
  },
  lilacBlob: {
    position: 'absolute',
    left: -80,
    top: 300,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: colors.lilac,
    opacity: 0.45,
  },
  butterDot: {
    position: 'absolute',
    right: 34,
    top: 176,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.butter,
  },
});
