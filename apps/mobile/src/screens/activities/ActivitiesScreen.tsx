import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
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
import { useBoard } from '../../features/activities/queries';
import { useAreaNames } from '../../features/catalog/queries';
import type { MemberParams } from '../../navigation/types';
import { colors, layout, sizes, spacing } from '../../theme';
import { ActivityCard } from './ActivityCard';

type Row =
  | { kind: 'heading'; when: StartsWhen }
  | { kind: 'activity'; activity: BoardActivity };

export function ActivitiesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MemberParams>>();
  const board = useBoard();
  const areas = useAreaNames();
  const rows: Row[] = groupBoard(board.data ?? []).flatMap(section => [
    { kind: 'heading' as const, when: section.when },
    ...section.activities.map(activity => ({
      kind: 'activity' as const,
      activity,
    })),
  ]);
  const post = () => navigation.navigate('CreateActivity');

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Text variant="h1" accessibilityRole="header">
          Activities
        </Text>
      </View>
      {board.isError ? (
        <View style={styles.padded}>
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
            <Button label="Post an Activity" onPress={post} />
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
  emptyBody: { marginTop: spacing.xs },
  padded: { paddingHorizontal: layout.pageMargin, gap: spacing.xs },
});
