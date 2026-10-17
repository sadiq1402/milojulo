import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Text } from '../../components';
import {
  groupBoard,
  startsWhenLabels,
  type BoardActivity,
  type StartsWhen,
} from '../../features/activities/model';
import {
  activityKeys,
  useBoard,
  useJoined,
  useStillListed,
} from '../../features/activities/queries';
import { useSession } from '../../features/auth/SessionProvider';
import { useAreaNames } from '../../features/catalog/queries';
import { useMyDiscoverState } from '../../features/discover/queries';
import type { MemberParams } from '../../navigation/types';
import { colors, layout, sizes, spacing } from '../../theme';
import { PausedNotice } from '../shared/PausedNotice';
import { ActivityCard } from './ActivityCard';
import { MeetPrompts } from './MeetPrompts';

type Row =
  | { kind: 'heading'; when: StartsWhen }
  | { kind: 'activity'; activity: BoardActivity };

export function ActivitiesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MemberParams>>();
  const board = useBoard();
  const listed = useStillListed(board.data);
  // The first focus is the first load; each later one shows the latest board.
  const focusedBefore = useRef(false);
  const { refetch } = board;
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) {
        refetch();
      }
      focusedBefore.current = true;
    }, [refetch]),
  );
  const me = useMyDiscoverState(useSession().session!.user.id);
  const areas = useAreaNames();
  const rows: Row[] = groupBoard(listed ?? []).flatMap(section => [
    { kind: 'heading' as const, when: section.when },
    ...section.activities.map(activity => ({
      kind: 'activity' as const,
      activity,
    })),
  ]);
  const post = () => navigation.navigate('CreateActivity');
  const joined = useJoined();
  const going = (joined.data ?? []).filter(
    activity => activity.requestStatus === 'accepted',
  ).length;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Text variant="h1" accessibilityRole="header">
          Activities
        </Text>
      </View>
      {me.data?.paused ? (
        <View style={styles.padded}>
          <PausedNotice
            explanation="While you're Paused, the Activity Board stays empty and you can't post. Your Connections and chats carry on as usual."
            alsoRefresh={activityKeys.all}
          />
        </View>
      ) : board.isError ? (
        <View style={styles.padded}>
          {/* The prompts don't depend on the board, so a failed board still shows them. */}
          <MeetPrompts />
          <Text color={colors.danger}>{board.error.message}</Text>
          <Button
            label="Try again"
            variant="text"
            compact
            onPress={() => board.refetch()}
          />
        </View>
      ) : (
        <FlatList
          testID="activity-board"
          data={rows}
          keyExtractor={row =>
            row.kind === 'heading' ? row.when : row.activity.id
          }
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <>
              <MeetPrompts />
              <View style={styles.actions}>
                <Button
                  label="Post"
                  accessibilityLabel="Post an Activity"
                  icon="plus"
                  compact
                  onPress={post}
                  style={styles.action}
                />
                <Button
                  label="Joined"
                  accessibilityLabel={
                    going > 0 ? `Joined, ${going} going` : 'Joined'
                  }
                  icon="calendarCheck"
                  badge={going}
                  variant="secondary"
                  compact
                  onPress={() => navigation.navigate('Joined')}
                  style={styles.action}
                />
              </View>
            </>
          }
          renderItem={({ item }) =>
            item.kind === 'heading' ? (
              <Text
                variant="h2"
                accessibilityRole="header"
                style={styles.heading}
              >
                {startsWhenLabels[item.when]}
              </Text>
            ) : (
              <ActivityCard
                activity={item.activity}
                areaName={areas.data?.[item.activity.areaId] ?? ''}
                onPress={() =>
                  navigation.navigate('ActivityDetail', {
                    activityId: item.activity.id,
                  })
                }
              />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={board.isRefetching}
              onRefresh={() => {
                board.refetch();
              }}
              colors={[colors.orchid]}
              tintColor={colors.orchid}
            />
          }
          ListEmptyComponent={
            board.isSuccess ? (
              <Card>
                <Text variant="h2">No Activities yet</Text>
                <Text color={colors.secondary} style={styles.emptyBody}>
                  Nothing is planned nearby right now. Post an Activity and see
                  who joins, or pull down to check again later.
                </Text>
              </Card>
            ) : (
              <ActivityIndicator color={colors.orchid} />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  header: {
    minHeight: sizes.topBar,
    justifyContent: 'center',
    paddingHorizontal: layout.pageMargin,
  },
  list: {
    padding: layout.pageMargin,
    paddingTop: spacing.xs,
    gap: layout.blockGap,
  },
  heading: { marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.xs },
  action: { flex: 1 },
  emptyBody: { marginTop: spacing.xs },
  padded: { paddingHorizontal: layout.pageMargin, gap: spacing.xs },
});
