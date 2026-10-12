import React, { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, layout } from '../theme';

type Props = { children: ReactNode; header?: ReactNode; scroll?: boolean };

// Page background, top safe area and the 20 page margin; tabs handle the bottom inset.
export function Screen({ children, header, scroll = true }: Props) {
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill]}>{children}</View>
  );
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      {header}
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  content: {
    paddingHorizontal: layout.pageMargin,
    paddingBottom: layout.sectionGap,
    gap: layout.blockGap,
  },
  fill: { flex: 1 },
});
