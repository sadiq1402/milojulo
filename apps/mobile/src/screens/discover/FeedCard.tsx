import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card, PhotoPlaceholder, Tag, Text } from '../../components';
import type { FeedCard as FeedCardData } from '../../features/discover/api';
import { modeLabels } from '../../features/modes';
import { colors, radius, sizes, spacing } from '../../theme';

type Props = {
  card: FeedCardData;
  areaName: string;
  tagNames: Record<number, string>;
  onPress: () => void;
};

export function FeedCard({ card, areaName, tagNames, onPress }: Props) {
  const tags = card.sharedTagIds.map(id => tagNames[id]).filter(Boolean);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${card.name}, ${card.age}, ${areaName}. ${card.whyYouMatch}`}
      accessibilityHint="Opens their profile"
    >
      <Card feed padded={false}>
        <PhotoPlaceholder
          name={card.name}
          seed={card.id}
          initialSize={initialSize}
          style={styles.media}
        >
          {areaName ? (
            <View style={styles.area}>
              <Tag label={areaName} tone="onPhoto" />
            </View>
          ) : null}
          <View style={styles.modes}>
            {card.modes.map(mode => (
              <Tag key={mode} label={modeLabels[mode]} tone={mode} />
            ))}
          </View>
        </PhotoPlaceholder>
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
const initialSize = Math.round(sizes.photo.feedMediaH * 0.42);

const styles = StyleSheet.create({
  media: { aspectRatio: sizes.photo.heroW / sizes.photo.feedMediaH },
  area: { position: 'absolute', left: spacing.sm, bottom: spacing.sm },
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
