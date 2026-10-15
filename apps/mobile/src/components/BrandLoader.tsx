import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { brandLogo, logoAspectRatio } from '../assets/brand';
import { colors, layout } from '../theme';
import { BrandBackground } from './BrandBackground';

const native = { useNativeDriver: true } as const;

type Props = { ready: boolean; onDone: () => void };

// Shown while the app restores the session: the logo fades and scales in, then pulses gently until
// ready, when it fades out (in ~300 ms, so a ready app isn't held up).
export function BrandLoader({ ready, onDone }: Props) {
  const fade = useRef(new Animated.Value(1)).current;
  const logo = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then(on => live && setReduceMotion(on));
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      live = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion === null || ready) return;
    if (reduceMotion) {
      logo.setValue(1);
      pulse.setValue(0);
      return;
    }
    const intro = Animated.sequence([
      Animated.timing(logo, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        ...native,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 1100,
            easing: Easing.inOut(Easing.sin),
            ...native,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 1100,
            easing: Easing.inOut(Easing.sin),
            ...native,
          }),
        ]),
      ),
    ]);
    intro.start();
    return () => intro.stop();
  }, [reduceMotion, ready, logo, pulse]);

  useEffect(() => {
    if (!ready) {
      fade.setValue(1);
      return;
    }
    if (reduceMotion === null) return;
    if (reduceMotion) {
      done.current();
      return;
    }
    const out = Animated.timing(fade, {
      toValue: 0,
      duration: 280,
      easing: Easing.in(Easing.quad),
      ...native,
    });
    out.start(({ finished }) => finished && done.current());
    return () => out.stop();
  }, [ready, reduceMotion, fade]);

  const scale = Animated.add(
    logo.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }),
    pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 0.03] }),
  );

  return (
    <Animated.View
      testID="brand-loader"
      style={[StyleSheet.absoluteFill, styles.screen, { opacity: fade }]}
    >
      <StatusBar barStyle="light-content" />
      <BrandBackground />
      <Animated.View
        testID="brand-loader-logo"
        style={{ opacity: logo, transform: [{ scale }] }}
      >
        <Image
          source={brandLogo}
          style={styles.logo}
          resizeMode="contain"
          accessible
          accessibilityRole="image"
          accessibilityLabel="MiloJulo"
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.pageMargin,
    backgroundColor: colors.ink,
  },
  logo: { width: 280, aspectRatio: logoAspectRatio },
});
