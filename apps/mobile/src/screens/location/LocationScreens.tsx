import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  FlowScreen,
  Icon,
  List,
  ListRow,
  Tag,
  Text,
} from '../../components';
import { colors, fontFamily, fonts, sizes, spacing } from '../../theme';

const privacy = [
  [
    'No one sees your location.',
    'Others see a rounded distance, like “~3 km”.',
  ],
  ['Shifted a few hundred metres', "so you can't be pinpointed."],
  [
    'Only the latest spot is kept,',
    'updated at most once an hour, and deleted with your account.',
  ],
];

function PinBadge({
  background,
  color,
}: {
  background: string;
  color: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Icon name="pin" size={sizes.icon.feature} color={color} />
    </View>
  );
}

// Asked before the phone's own permission dialog (Location mockup).
export function LocationScreen({
  onAllow,
  onNotNow,
  busy,
}: {
  onAllow: () => void;
  onNotNow: () => void;
  busy: boolean;
}) {
  return (
    <FlowScreen
      icon={<PinBadge background={colors.tint} color={colors.orchid} />}
      title="See who’s nearby"
      intro="MiloJulo uses your phone’s location to show people within the distance you choose. Only while the app is open, never in the background."
      footer={
        <View style={styles.actions}>
          <Button label="Allow location" onPress={onAllow} loading={busy} />
          <Button label="Not now" variant="text" onPress={onNotNow} />
        </View>
      }
    >
      <Card>
        <Text variant="bodySmall" style={styles.label}>
          How we keep it private
        </Text>
        {privacy.map(([lead, rest]) => (
          <Text key={lead} variant="bodySmall" color={colors.tagNeutralInk}>
            {'•  '}
            <Text
              variant="bodySmall"
              color={colors.tagNeutralInk}
              style={styles.label}
            >
              {lead}
            </Text>{' '}
            {rest}
          </Text>
        ))}
      </Card>
    </FlowScreen>
  );
}

// Shown once after location is refused (LocationOff mockup).
export function LocationOffScreen({
  area,
  onOpenSettings,
  onContinue,
}: {
  area?: string;
  onOpenSettings: () => void;
  onContinue: () => void;
}) {
  return (
    <FlowScreen
      icon={<PinBadge background={colors.butterSoft} color={colors.ink} />}
      title="Using your area instead"
      intro="Without location, we measure distance from the centre of your area, so it’s less accurate. You can turn location on any time."
      footer={
        <View style={styles.actions}>
          <Button label="Turn on in Settings" onPress={onOpenSettings} />
          <Button
            label={area ? `Continue with ${area}` : 'Continue'}
            variant="text"
            onPress={onContinue}
          />
        </View>
      }
    >
      <List>
        <ListRow
          title="Your area"
          subtitle="Distances are measured from here"
          right={area ? <Tag label={area} /> : undefined}
        />
      </List>
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: sizes.avatar.profile,
    height: sizes.avatar.profile,
    borderRadius: sizes.avatar.profile / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: fontFamily(fonts.text, '600') },
  actions: { gap: spacing.xs },
});
