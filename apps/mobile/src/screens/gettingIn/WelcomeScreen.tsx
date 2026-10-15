import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Image, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text } from '../../components';
import { brandLogo, logoAspectRatio } from '../../assets/brand';
import { BrandBackground } from '../../components/BrandBackground';
import type { SignedOutParams } from '../../navigation/types';
import {
  colors,
  fontFamily,
  fonts,
  layout,
  radius,
  sizes,
  spacing,
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
      <BrandBackground glowY="18%" />
      <SafeAreaView edges={['top', 'bottom']} style={styles.fill}>
        <View style={styles.content}>
          <Image
            testID="welcome-logo"
            source={brandLogo}
            style={styles.logo}
            resizeMode="contain"
            accessible
            accessibilityRole="header"
            accessibilityLabel="MiloJulo"
          />
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
  screen: { flex: 1, backgroundColor: colors.ink, overflow: 'hidden' },
  fill: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    gap: layout.sectionGap,
  },
  logo: { width: 200, aspectRatio: logoAspectRatio, alignSelf: 'center' },
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
});
