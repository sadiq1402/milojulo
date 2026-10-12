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

// badge counts what's waiting on the tab; badgeLabel words it for screen readers ("2 waiting").
export type TabItem = {
  key: string;
  label: string;
  icon: IconName;
  badge?: number;
  badgeLabel?: string;
};

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
        const badge = item.badge ?? 0;
        return (
          <Pressable
            key={item.key}
            onPress={() => onSelect(item.key)}
            accessibilityRole="tab"
            accessibilityLabel={
              badge > 0
                ? `${item.label}, ${badge} ${item.badgeLabel ?? 'new'}`
                : item.label
            }
            accessibilityState={{ selected: active }}
            style={styles.tab}
          >
            <View style={[styles.pill, active && styles.pillActive]}>
              <Icon name={item.icon} color={tint} />
              {badge > 0 ? (
                <View style={styles.badge}>
                  <Text variant="caption" color={colors.white}>
                    {badge > 99 ? '99+' : badge}
                  </Text>
                </View>
              ) : null}
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
  badge: {
    position: 'absolute',
    top: -spacing.xxs,
    right: 0,
    minWidth: sizes.tabBadge.min,
    minHeight: sizes.tabBadge.min,
    borderRadius: sizes.tabBadge.min / 2,
    paddingHorizontal: sizes.tabBadge.paddingX,
    backgroundColor: colors.orchid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: fontFamily(fonts.text, '500') },
  labelActive: { fontFamily: fontFamily(fonts.text, '700') },
});
