import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { PhotoPlaceholder } from '../../components';
import { usePhotoUrl } from '../../features/photos/queries';
import { colors, radius, sizes, spacing } from '../../theme';

type Props = {
  name: string;
  seed: string;
  photoIds: string[];
  onPress: () => void;
  // Overlaid on every photo: the location chip and the Mode tags.
  children: React.ReactNode;
};

// One photo, sized by the card's media box. Each is its own component so every photo asks for
// its link through the batching hook rather than one call per photo (#199).
function Page({
  name,
  seed,
  photoId,
  width,
  onPress,
}: {
  name: string;
  seed: string;
  photoId: string | null;
  width: number;
  onPress: () => void;
}) {
  const photo = usePhotoUrl(photoId);
  return (
    <Pressable onPress={onPress} style={width > 0 ? { width } : styles.grow}>
      <PhotoPlaceholder
        name={name}
        seed={seed}
        initialSize={initialSize}
        uri={photo.data}
        style={styles.media}
      />
    </Pressable>
  );
}

// A Member's photos on the feed card, swiped through without leaving the feed (#199).
export function PhotoPager({ name, seed, photoIds, onPress, children }: Props) {
  const [width, setWidth] = useState(0);
  const [shown, setShown] = useState(0);
  // A Member always has at least one page, so the initial shows before any photo arrives.
  const pages = photoIds.length > 0 ? photoIds : [null];
  const at = Math.min(shown, pages.length - 1);

  return (
    <View
      style={styles.media}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
    >
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={pages.length > 1}
        accessibilityLabel={`Photos of ${name}`}
        onScroll={event => {
          const page = event.nativeEvent.layoutMeasurement.width;
          setShown(
            page > 0 ? Math.round(event.nativeEvent.contentOffset.x / page) : 0,
          );
        }}
        scrollEventThrottle={16}
      >
        {pages.map((photoId, i) => (
          <Page
            key={photoId ?? `empty-${i}`}
            name={name}
            seed={seed}
            photoId={photoId}
            width={width}
            onPress={onPress}
          />
        ))}
      </ScrollView>
      {children}
      {pages.length > 1 ? (
        <View
          style={styles.dots}
          accessibilityLabel={`Photo ${at + 1} of ${pages.length}`}
        >
          {pages.map((photoId, i) => (
            <View
              key={photoId ?? `dot-${i}`}
              style={[styles.dot, i === at && styles.dotOn]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const initialSize = Math.round(sizes.photo.feedMediaH * 0.42);

const styles = StyleSheet.create({
  media: { aspectRatio: sizes.photo.heroW / sizes.photo.feedMediaH },
  grow: { flexGrow: 1 },
  dots: {
    position: 'absolute',
    top: spacing.sm,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  dot: {
    width: spacing.xs,
    height: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: colors.white,
    opacity: 0.5,
  },
  dotOn: { opacity: 1 },
});
