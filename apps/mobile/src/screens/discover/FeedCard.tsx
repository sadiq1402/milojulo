import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Tag, Text } from '../../components';
import type { FeedCard as FeedCardData } from '../../features/discover/api';
import { modeLabels } from '../../features/modes';
import { colors, radius, spacing } from '../../theme';
import { PhotoPager } from './PhotoPager';

type Props = {
  card: FeedCardData;
  tagNames: Record<number, string>;
  onPress: () => void;
};

export function FeedCard({ card, tagNames, onPress }: Props) {
  const tags = card.sharedTagIds.map(id => tagNames[id]).filter(Boolean);
  const place = card.distanceBand;
  // With no Mode in common, the card shows what they're here for.
  const modes = card.modes.length > 0 ? card.modes : card.theirModes;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${card.name}, ${card.age}, ${place}. ${card.whyYouMatch}`}
      accessibilityHint="Opens their profile"
    >
      <Card feed padded={false}>
        <PhotoPager
          name={card.name}
          seed={card.id}
          photoIds={card.photoIds}
          onPress={onPress}
        >
          {place ? (
            <View style={styles.place}>
              <Tag label={place} tone="onPhoto" />
            </View>
          ) : null}
          <View style={styles.modes}>
            {modes.map(mode => (
              <Tag key={mode} label={modeLabels[mode]} tone={mode} />
            ))}
          </View>
        </PhotoPager>
        <View style={styles.body}>
          <Text variant="h1">
            {card.name}, {card.age}
          </Text>
          <MatchNote text={card.whyYouMatch} />
          {tags.length > 0 ? (
            <View style={styles.tags}>
              {tags.map(label => (
                <Tag key={label} label={label} tone="match" />
              ))}
            </View>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

export function MatchNote({ text }: { text: string }) {
  return (
    <View style={styles.note}>
      <Text variant="bodySmall" color={colors.orchidDark}>
        {text}
      </Text>
    </View>
  );
}

// Initial sized to the feed media as in the mockup.
const styles = StyleSheet.create({
  place: { position: 'absolute', left: spacing.sm, bottom: spacing.sm },
  modes: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm,
    flexDirection: 'row',
    gap: spacing.xxs,
  },
  body: { padding: spacing.md, gap: spacing.sm },
  note: {
    backgroundColor: colors.selected,
    borderRadius: radius.r16,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs },
});
