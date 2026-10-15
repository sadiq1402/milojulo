import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Chip, Icon, Text } from '../../components';
import { useSession } from '../../features/auth/SessionProvider';
import type { FeedCard as FeedCardData } from '../../features/discover/api';
import type { RangeKm } from '../../features/discover/range';
import { useAreaNames, useTagNames } from '../../features/catalog/queries';
import {
  useFeed,
  useMyDiscoverState,
  useSaveRange,
} from '../../features/discover/queries';
import { modeLabels, type Mode } from '../../features/modes';
import type { MemberParams } from '../../navigation/types';
import { colors, layout, radius, sizes, spacing } from '../../theme';
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
  const rangeKm = me.data?.rangeKm ?? null;

  const chooseRange = (next: RangeKm | null) => {
    setPicker(null);
    if (next !== rangeKm) {
      saveRange.mutate(next);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Text
          variant="h1"
          accessibilityRole="header"
          accessibilityLabel="Discover"
        >
          <Text variant="h1" color={colors.orchid}>
            Milo
          </Text>
          <Text variant="h1" color={colors.violet}>
            Julo
          </Text>
        </Text>
      </View>
      {me.isError ? (
        <LoadError message={me.error.message} onRetry={() => me.refetch()} />
      ) : paused ? (
        <View style={styles.padded}>
          <PausedNotice explanation="While you're Paused, nobody new sees you and Discover stays empty. Your Connections and chats carry on as usual." />
        </View>
      ) : me.data?.inServiceRegion === false ? (
        <NotInCity />
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
            myModes={me.data!.modes}
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
  50: null,
};

function Feed({
  modes,
  rangeKm,
  onWiden,
  onChooseDistance,
}: {
  modes: Mode[];
  rangeKm: RangeKm | null;
  onWiden: (rangeKm: RangeKm | null) => void;
  onChooseDistance: () => void;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<MemberParams>>();
  const feed = useFeed(modes, rangeKm);
  const areas = useAreaNames();
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
  const wider = rangeKm === null ? null : widerRange[rangeKm];
  return (
    <FlatList
      testID="discover-feed"
      data={cards}
      keyExtractor={(card: FeedCardData) => card.id}
      contentContainerStyle={[styles.list, cards.length === 0 && styles.grow]}
      renderItem={({ item }: { item: FeedCardData }) => (
        <FeedCard
          card={item}
          areaName={areas.data?.[item.areaId] ?? ''}
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
        ) : rangeKm === null ? (
          <EmptyState title="Nobody here yet" body="Check back soon." />
        ) : (
          <EmptyState
            title={`Nobody within ${rangeKm} km yet`}
            body="Try a wider distance to see more people."
          >
            <Button
              label={
                wider === null
                  ? 'Show anywhere in Pune'
                  : `Widen to ${wider} km`
              }
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

function NotInCity() {
  const navigation = useNavigation<NavigationProp<{ Me: undefined }>>();
  return (
    <View style={[styles.padded, styles.grow]}>
      <EmptyState
        title="MiloJulo isn't in your city yet"
        body="We're starting in Pune. Your profile is saved."
      >
        <Button
          label="Edit profile"
          variant="secondary"
          onPress={() => navigation.navigate('Me')}
        />
      </EmptyState>
    </View>
  );
}

function EmptyState({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name="pin" size={44} color={colors.orchid} />
      </View>
      <Text variant="h1" accessibilityRole="header" style={styles.center}>
        {title}
      </Text>
      <Text color={colors.secondary} style={styles.center}>
        {body}
      </Text>
      {children ? <View style={styles.emptyActions}>{children}</View> : null}
    </View>
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

const emptyIcon = 96;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  header: {
    minHeight: sizes.topBar,
    justifyContent: 'center',
    paddingHorizontal: layout.pageMargin,
  },
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
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: layout.blockGap,
    paddingHorizontal: spacing.xs,
  },
  emptyIcon: {
    width: emptyIcon,
    height: emptyIcon,
    borderRadius: radius.full,
    backgroundColor: colors.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  emptyActions: {
    alignSelf: 'stretch',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  padded: { paddingHorizontal: layout.pageMargin, gap: spacing.xs },
});
