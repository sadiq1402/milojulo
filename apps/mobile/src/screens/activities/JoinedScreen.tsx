import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, SegmentedControl, Text, TopBar } from '../../components';
import { useJoined } from '../../features/activities/queries';
import type { MemberParams } from '../../navigation/types';
import { colors, layout, spacing } from '../../theme';
import { ActivityCard } from './ActivityCard';

type Tab = 'going' | 'waiting';

const empty: Record<Tab, string> = {
  going: "You're not going to any Activities yet.",
  waiting: 'No Join Requests waiting.',
};

export function JoinedScreen({
  navigation,
}: NativeStackScreenProps<MemberParams, 'Joined'>) {
  const [tab, setTab] = useState<Tab>('going');
  const joined = useJoined();
  const shown = (joined.data ?? []).filter(activity =>
    tab === 'going'
      ? activity.requestStatus === 'accepted'
      : activity.requestStatus === 'requested',
  );

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <TopBar title="Joined" onBack={navigation.goBack} />
      <View style={styles.padded}>
        <SegmentedControl
          options={[
            { value: 'going', label: 'Going' },
            { value: 'waiting', label: 'Waiting' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>
      {joined.isError ? (
        <View style={styles.padded}>
          <Text color={colors.danger}>{joined.error.message}</Text>
          <Button
            label="Try again"
            variant="text"
            compact
            onPress={() => joined.refetch()}
          />
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={activity => activity.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            tab === 'waiting' && shown.length > 0 ? (
              <Text variant="bodySmall" color={colors.secondary}>
                The host hasn't answered yet.
              </Text>
            ) : undefined
          }
          renderItem={({ item }) => (
            <ActivityCard
              activity={item}
              onPress={() =>
                navigation.navigate('ActivityDetail', { activityId: item.id })
              }
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={joined.isRefetching}
              onRefresh={() => {
                joined.refetch();
              }}
              colors={[colors.orchid]}
              tintColor={colors.orchid}
            />
          }
          ListEmptyComponent={
            joined.isSuccess ? (
              <Card>
                <Text color={colors.secondary}>{empty[tab]}</Text>
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
  padded: { paddingHorizontal: layout.pageMargin, gap: spacing.xs },
  list: {
    padding: layout.pageMargin,
    paddingTop: layout.blockGap,
    gap: layout.blockGap,
  },
});
