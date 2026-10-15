import React, { type ReactNode, type Ref } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, layout, spacing } from '../theme';
import { Progress } from './Progress';
import { Text } from './Text';
import { TopBar } from './TopBar';

type Props = {
  title: string;
  intro?: string;
  onBack?: () => void;
  // Profile setup: the top bar's title and the step progress under it.
  barTitle?: string;
  progress?: { step: number; of: number };
  // A feature icon above the heading.
  icon?: ReactNode;
  children?: ReactNode;
  footer: ReactNode;
  scrollRef?: Ref<React.ComponentRef<typeof ScrollView>>;
};

// The plain onboarding layout (Email, Otp, AgeConsent, profile setup): tint and butter
// circles in the corner, heading, content, and the main action pinned to the bottom.
export function FlowScreen({
  title,
  intro,
  onBack,
  barTitle,
  progress,
  icon,
  children,
  footer,
  scrollRef,
}: Props) {
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.tintCircle} />
      <View style={styles.butterDot} />
      <TopBar onBack={onBack} title={barTitle} />
      {progress ? <Progress {...progress} /> : null}
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {icon}
          <Text variant="h1" accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {intro ? <Text color={colors.secondary}>{intro}</Text> : null}
          {children}
          <View style={styles.fill} />
          <View style={styles.footer}>{footer}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const dot = { right: 28, size: 44 };

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  fill: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: layout.pageMargin,
    paddingTop: spacing.xs,
    gap: layout.blockGap,
  },
  // Keeps a long heading clear of the butter dot, which sits beside it.
  title: { paddingRight: dot.right + dot.size - layout.pageMargin },
  footer: { paddingBottom: spacing.xl, gap: spacing.xxs },
  // Decoration from the mockups (390-wide frame).
  tintCircle: {
    position: 'absolute',
    right: -90,
    top: -70,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: colors.tint,
  },
  butterDot: {
    position: 'absolute',
    right: dot.right,
    top: 118,
    width: dot.size,
    height: dot.size,
    borderRadius: dot.size / 2,
    backgroundColor: colors.butter,
    opacity: 0.85,
  },
});
