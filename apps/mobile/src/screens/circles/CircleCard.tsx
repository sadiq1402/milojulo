import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Icon, Tag, Text } from '../../components';
import { memberCountLabel, type Circle } from '../../features/circles/model';
import { sizes, spacing } from '../../theme';
import { DistanceBand } from './DistanceBand';

type Props = {
  circle: Circle;
  interest: string;
  onPress: () => void;
};

export function CircleCard({ circle, interest, onPress }: Props) {
  const members = memberCountLabel(circle.memberCount);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${circle.name}, ${circle.placeName}, ${
        circle.distanceBand ? `${circle.distanceBand}, ` : ''
      }${interest}, ${members}${circle.iAmMember ? ', joined' : ''}`}
      accessibilityHint="Opens the Circle"
    >
      <Card style={styles.card}>
        <View style={styles.top}>
          <Text variant="h2" style={styles.title}>
            {circle.name}
          </Text>
          {circle.iAmMember ? <Tag label="Joined" tone="match" /> : null}
        </View>
        {circle.description ? (
          <Text numberOfLines={2}>{circle.description}</Text>
        ) : null}
        <View style={styles.tags}>
          <Tag label={circle.placeName} />
          <DistanceBand band={circle.distanceBand} />
          <Tag label={interest} />
        </View>
        <View style={styles.count}>
          <Icon name="circles" size={sizes.icon.tiny} />
          <Text variant="bodySmall">{members}</Text>
        </View>
      </Card>
    </Pressable>
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
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  count: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
});
