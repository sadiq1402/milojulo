import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  colors,
  fontFamily,
  fonts,
  radius,
  shadow,
  sizes,
  spacing,
} from '../theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type TabItem = { key: string; label: string; icon: IconName };

type Props = {
  items: TabItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  bottomInset: number;
};

export function TabBar({ items, activeKey, onSelect, bottomInset }: Props) {
  return (
    <View
      style={[styles.bar, { paddingBottom: bottomInset }]}
      accessibilityRole="tablist"
    >
      {items.map(item => {
        const active = item.key === activeKey;
        const tint = active ? colors.orchid : colors.secondary;
        return (
          <Pressable
            key={item.key}
            onPress={() => onSelect(item.key)}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
            style={styles.tab}
          >
            <View style={[styles.pill, active && styles.pillActive]}>
              <Icon name={item.icon} color={tint} />
            </View>
            <Text
              variant="caption"
              color={tint}
              style={active ? styles.labelActive : styles.label}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.r24,
    borderTopRightRadius: radius.r24,
    paddingTop: spacing.xxs,
    paddingHorizontal: spacing.xs,
    ...shadow('tabBar'),
  },
  tab: {
    flex: 1,
    minHeight: sizes.tabBarContent - spacing.xxs,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  pill: {
    width: sizes.tabPill.w,
    height: sizes.tabPill.h,
    borderRadius: sizes.tabPill.h / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: colors.tint },
  label: { fontFamily: fontFamily(fonts.text, '500') },
  labelActive: { fontFamily: fontFamily(fonts.text, '700') },
});
