import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Button, Card, Chip, Text } from '../../components';
import { useSession } from '../../features/auth/SessionProvider';
import {
  unpause,
  type FeedCard as FeedCardData,
} from '../../features/discover/api';
import {
  discoverKeys,
  useAreaNames,
  useFeed,
  useMyDiscoverState,
  useTagNames,
} from '../../features/discover/queries';
import { modeLabels, type Mode } from '../../features/modes';
import type { MemberParams } from '../../navigation/types';
import { colors, layout, modeTints, sizes, spacing } from '../../theme';
import { FeedCard } from './FeedCard';

export function DiscoverScreen() {
  const userId = useSession().session!.user.id;
  const me = useMyDiscoverState(userId);
  const [mode, setMode] = useState<Mode | null>(null);
  const paused = me.data?.paused;

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
        <PausedNotice />
      ) : paused === false ? (
        <>
          <ModeFilter modes={me.data!.modes} value={mode} onChange={setMode} />
          <Feed mode={mode} />
        </>
      ) : null}
    </SafeAreaView>
  );
}

function ModeFilter({
  modes,
  value,
  onChange,
}: {
  modes: Mode[];
  value: Mode | null;
  onChange: (mode: Mode | null) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
      style={styles.chipRow}
    >
      <Chip
        label="All"
        selected={value === null}
        onPress={() => onChange(null)}
      />
      {modes.map(mode => (
        <Chip
          key={mode}
          label={modeLabels[mode]}
          tint={modeTints[mode]}
          selected={value === mode}
          onPress={() => onChange(mode)}
        />
      ))}
    </ScrollView>
  );
}

function Feed({ mode }: { mode: Mode | null }) {
  const navigation = useNavigation<NativeStackNavigationProp<MemberParams>>();
  const feed = useFeed(mode);
  const areas = useAreaNames();
  const tags = useTagNames();
  const cards = feed.data?.pages.flatMap(page => page.cards) ?? [];

  if (feed.isError && cards.length === 0) {
    return (
      <LoadError message={feed.error.message} onRetry={() => feed.refetch()} />
    );
  }
  return (
    <FlatList
      testID="discover-feed"
      data={cards}
      keyExtractor={(card: FeedCardData) => card.id}
      contentContainerStyle={styles.list}
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
        feed.isSuccess ? (
          <Card>
            <Text variant="h2">Nobody new right now</Text>
            <Text color={colors.secondary} style={styles.emptyBody}>
              {mode
                ? `Nobody who shares ${modeLabels[mode]} with you is around yet.`
                : 'Nobody who shares a Mode with you is around yet.'}{' '}
              Pull down to check again later.
            </Text>
          </Card>
        ) : (
          <ActivityIndicator color={colors.orchid} />
        )
      }
      ListFooterComponent={
        feed.isFetchingNextPage ? (
          <ActivityIndicator color={colors.orchid} />
        ) : undefined
      }
    />
  );
}

function PausedNotice() {
  const client = useQueryClient();
  const resume = useMutation({
    mutationFn: unpause,
    onSuccess: () => client.invalidateQueries({ queryKey: discoverKeys.all }),
  });
  return (
    <View style={styles.padded}>
      <Card style={styles.paused}>
        <Text variant="h2">Your profile is paused</Text>
        <Text color={colors.secondary}>
          While you're Paused, nobody new sees you and Discover stays empty.
          Your Connections and chats carry on as usual.
        </Text>
        <Button
          label="Unpause"
          loading={resume.isPending}
          onPress={() => resume.mutate()}
        />
        {resume.isError ? (
          <Text
            variant="bodySmall"
            color={colors.danger}
            accessibilityLiveRegion="polite"
          >
            {resume.error.message}
          </Text>
        ) : null}
      </Card>
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
  list: {
    padding: layout.pageMargin,
    paddingTop: spacing.xs,
    gap: layout.blockGap,
  },
  emptyBody: { marginTop: spacing.xs },
  padded: { paddingHorizontal: layout.pageMargin, gap: spacing.xs },
  paused: { gap: spacing.sm },
});
