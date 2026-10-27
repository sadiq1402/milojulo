import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { brandMark, markAspectRatio } from '../../assets/brand';
import { Button, Chip, Text } from '../../components';
import { useSession } from '../../features/auth/SessionProvider';
import type { FeedCard as FeedCardData } from '../../features/discover/api';
import type { RangeKm } from '../../features/discover/range';
import { useTagNames } from '../../features/catalog/queries';
import {
  useFeed,
  useMyDiscoverState,
  useSaveRange,
} from '../../features/discover/queries';
import { modeLabels, type Mode } from '../../features/modes';
import type { MemberParams } from '../../navigation/types';
import { colors, layout, sizes, spacing } from '../../theme';
import {
  needsLocationBody,
  needsLocationTitle,
} from '../location/LocationScreens';
import { EmptyState, NeedsLocation } from '../shared/NeedsLocation';
import { PausedNotice } from '../shared/PausedNotice';
import { DistanceSheet, ModesSheet, rangeLabel } from './DiscoverSheets';
import { FeedCard } from './FeedCard';

export function DiscoverScreen() {
  const userId = useSession().session!.user.id;
  const me = useMyDiscoverState(userId);
  const saveRange = useSaveRange(userId);
  const [modes, setModes] = useState<Mode[]>([]);
  const [picker, setPicker] = useState<'distance' | 'modes' | null>(null);
  const paused = me.data?.paused;
  const rangeKm = me.data?.rangeKm ?? 10;

  const chooseRange = (next: RangeKm) => {
    setPicker(null);
    if (next !== rangeKm) {
      saveRange.mutate(next);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel="Discover"
        >
          <Image
            source={brandMark}
            style={styles.mark}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="MiloJulo"
          />
        </View>
      </View>
      {me.isError ? (
        <LoadError message={me.error.message} onRetry={() => me.refetch()} />
      ) : paused ? (
        <View style={styles.padded}>
          <PausedNotice explanation="While you're Paused, nobody new sees you and Discover stays empty. Your Connections and chats carry on as usual." />
        </View>
      ) : me.data?.hasLocation === false ? (
        <NeedsLocation title={needsLocationTitle} body={needsLocationBody} />
      ) : paused === false ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
            style={styles.chipRow}
          >
            <Chip
              icon="pin"
              opensPicker
              label={rangeLabel(rangeKm)}
              accessibilityLabel={`Distance: ${rangeLabel(rangeKm)}`}
              onPress={() => setPicker('distance')}
            />
            <Chip
              opensPicker
              label={modesLabel(modes)}
              accessibilityLabel={`Modes: ${modesLabel(modes)}`}
              selected={modes.length > 0}
              onPress={() => setPicker('modes')}
            />
          </ScrollView>
          {saveRange.isError ? (
            <Text
              variant="bodySmall"
              color={colors.danger}
              accessibilityLiveRegion="polite"
              style={styles.chipError}
            >
              {saveRange.error.message}
            </Text>
          ) : null}
          <Feed
            modes={modes}
            rangeKm={rangeKm}
            onWiden={chooseRange}
            onChooseDistance={() => setPicker('distance')}
          />
          <DistanceSheet
            visible={picker === 'distance'}
            value={rangeKm}
            onClose={() => setPicker(null)}
            onChoose={chooseRange}
          />
          <ModesSheet
            visible={picker === 'modes'}
            value={modes}
            onClose={() => setPicker(null)}
            onChoose={next => {
              setPicker(null);
              setModes(next);
            }}
          />
        </>
      ) : null}
    </SafeAreaView>
  );
}

function modesLabel(modes: Mode[]): string {
  if (modes.length === 0) {
    return 'All Modes';
  }
  return modes.length === 1 ? modeLabels[modes[0]] : `${modes.length} Modes`;
}

const widerRange: Record<RangeKm, RangeKm | null> = {
  2: 5,
  5: 10,
  10: 25,
  25: 50,
  50: 100,
  100: null,
};

function Feed({
  modes,
  rangeKm,
  onWiden,
  onChooseDistance,
}: {
  modes: Mode[];
  rangeKm: RangeKm;
  onWiden: (rangeKm: RangeKm) => void;
  onChooseDistance: () => void;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<MemberParams>>();
  const feed = useFeed(modes, rangeKm);
  const tags = useTagNames();
  // The score behind the cursor is live, so a profile edited between pages can come up twice.
  const cards = [
    ...new Map(
      (feed.data?.pages.flatMap(page => page.cards) ?? []).map(card => [
        card.id,
        card,
      ]),
    ).values(),
  ];

  if (feed.isError && cards.length === 0) {
    return (
      <LoadError message={feed.error.message} onRetry={() => feed.refetch()} />
    );
  }
  const wider = widerRange[rangeKm];
  return (
    <FlatList
      testID="discover-feed"
      data={cards}
      keyExtractor={(card: FeedCardData) => card.id}
      contentContainerStyle={[styles.list, cards.length === 0 && styles.grow]}
      renderItem={({ item }: { item: FeedCardData }) => (
        <FeedCard
          card={item}
          tagNames={tags.data ?? {}}
          onPress={() => navigation.navigate('Profile', { memberId: item.id })}
        />
      )}
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) {
          feed.fetchNextPage();
        }
      }}
      refreshControl={
        <RefreshControl
          refreshing={feed.isRefetching && !feed.isFetchingNextPage}
          onRefresh={() => {
            feed.refetch();
          }}
          colors={[colors.orchid]}
          tintColor={colors.orchid}
        />
      }
      ListEmptyComponent={
        !feed.isSuccess || feed.hasNextPage ? (
          <ActivityIndicator color={colors.orchid} />
        ) : wider === null ? (
          <EmptyState
            title={`Nobody within ${rangeKm} km yet`}
            body="Check back soon."
          />
        ) : (
          <EmptyState
            title={`Nobody within ${rangeKm} km yet`}
            body="Try a wider distance to see more people."
          >
            <Button
              label={`Widen to ${wider} km`}
              onPress={() => onWiden(wider)}
            />
            <Button
              label="Choose distance"
              variant="text"
              onPress={onChooseDistance}
            />
          </EmptyState>
        )
      }
      ListFooterComponent={
        feed.isFetchingNextPage && cards.length > 0 ? (
          <ActivityIndicator color={colors.orchid} />
        ) : undefined
      }
    />
  );
}

function LoadError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.padded}>
      <Text color={colors.danger}>{message}</Text>
      <Button label="Try again" variant="text" compact onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  header: {
    minHeight: sizes.topBar,
    justifyContent: 'center',
    paddingHorizontal: layout.pageMargin,
  },
  // The logo's mark alone (founder, #198): the lettering read badly at header size.
  mark: { height: 40, aspectRatio: markAspectRatio },
  chipRow: { flexGrow: 0 },
  chips: {
    paddingHorizontal: layout.pageMargin,
    paddingBottom: spacing.xs,
    gap: sizes.chip.gap,
  },
  chipError: { paddingHorizontal: layout.pageMargin },
  list: {
    padding: layout.pageMargin,
    paddingTop: spacing.xs,
    gap: layout.blockGap,
  },
  grow: { flexGrow: 1 },
  padded: { paddingHorizontal: layout.pageMargin, gap: spacing.xs },
});
