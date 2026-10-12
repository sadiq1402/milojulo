import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    <View style={styles.screen}>
      {focused ? <StatusBar barStyle="light-content" /> : null}
      <View style={styles.pinkBlob} />
      <View style={styles.lilacBlob} />
      <View style={styles.butterDot} />
      <SafeAreaView edges={['top', 'bottom']} style={styles.fill}>
        <View style={styles.content}>
          <Text
            variant="h1"
            accessibilityRole="header"
            accessibilityLabel="MiloJulo"
          >
            <Text style={textStyles.h1} color={colors.white}>
              Milo
            </Text>
            <Text style={textStyles.h1} color={colors.butter}>
              Julo
            </Text>
          </Text>
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
              label="I have an invite code"
              variant="inverse"
              onPress={() => navigation.navigate('InviteCode')}
            />
            <Text
              variant="bodySmall"
              color={colors.white}
              style={styles.centred}
            >
              Invite-only while we test in Pune.
            </Text>
            <Button
              label="I already have an account"
              variant="inverseText"
              onPress={() => navigation.navigate('Email')}
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.orchid, overflow: 'hidden' },
  fill: { flex: 1 },
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
