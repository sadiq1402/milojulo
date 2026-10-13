import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar, Card, Icon, Tag, Text } from '../../components';
import {
  activityTypeLabels,
  hostLine,
  spotsLeftLabel,
  type BoardActivity,
} from '../../features/activities/model';
import { formatWhen } from '../../features/activities/time';
import { activityTones, photoTones, sizes, spacing } from '../../theme';

type Props = { activity: BoardActivity; areaName: string; onPress: () => void };

// The avatar's tone must differ from the card's, or a pink Games card hides a pink avatar.
const hostTone = (activity: BoardActivity) =>
  photoTones[0] === activityTones[activity.type] ? 1 : 0;

export function ActivityCard({ activity, areaName, onPress }: Props) {
  const when = formatWhen(activity.startsAt, null);
  const spots = spotsLeftLabel(activity.spotsLeft);
  const type = activityTypeLabels[activity.type];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${
        activity.title
      }, ${type}, ${areaName}, ${when}, ${hostLine(
        activity,
      ).toLowerCase()}, ${spots}`}
      accessibilityHint="Opens the Activity"
    >
      <Card
        style={[styles.card, { backgroundColor: activityTones[activity.type] }]}
      >
        <View style={styles.top}>
          <Text variant="h2" style={styles.title}>
            {activity.title}
          </Text>
          <Tag label={spots} tone="onPhoto" />
        </View>
        <View style={styles.facts}>
          <Fact icon="pin" text={areaName} />
          <Fact icon="clock" text={when} />
        </View>
        <View style={styles.bottom}>
          <View style={styles.host}>
            <Avatar
              name={activity.hostName}
              size="inline"
              tone={hostTone(activity)}
            />
            <Text variant="bodySmall">{hostLine(activity)}</Text>
          </View>
          <Tag label={type} tone="onPhoto" />
        </View>
      </Card>
    </Pressable>
  );
}

function Fact({ icon, text }: { icon: 'pin' | 'clock'; text: string }) {
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={sizes.icon.tiny} />
      <Text variant="bodySmall">{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.xs },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  title: { flex: 1 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md },
  fact: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  host: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
