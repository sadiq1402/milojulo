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
import { useSession } from '../../features/auth/SessionProvider';
import { useAreaNames, useTagNames } from '../../features/catalog/queries';
import { circleKeys, useCircles } from '../../features/circles/queries';
import { useMyDiscoverState } from '../../features/discover/queries';
import type { MemberParams } from '../../navigation/types';
import { colors, layout, sizes, spacing } from '../../theme';
import { PausedNotice } from '../shared/PausedNotice';
import { CircleCard } from './CircleCard';

export function CirclesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MemberParams>>();
  const circles = useCircles();
  const me = useMyDiscoverState(useSession().session!.user.id);
  const areas = useAreaNames();
  const tags = useTagNames();

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Text variant="h1" accessibilityRole="header">
          Circles
        </Text>
      </View>
      {me.data?.paused ? (
        <View style={styles.padded}>
          <PausedNotice
            explanation="While you're Paused, Circles stay hidden and you can't join new ones. Your Connections and chats carry on as usual."
            alsoRefresh={circleKeys.all}
          />
        </View>
      ) : circles.isError ? (
        <View style={styles.padded}>
          <Text color={colors.danger}>{circles.error.message}</Text>
          <Button
            label="Try again"
            variant="text"
            compact
            onPress={() => circles.refetch()}
          />
        </View>
      ) : (
        <FlatList
          testID="circles-list"
          data={circles.data ?? []}
          keyExtractor={circle => circle.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text color={colors.secondary}>
              Small local communities around a place and a shared interest. Our
              team creates them during the beta.
            </Text>
          }
          renderItem={({ item }) => (
            <CircleCard
              circle={item}
              areaName={areas.data?.[item.areaId] ?? ''}
              interest={tags.data?.[item.tagId] ?? ''}
              onPress={() =>
                navigation.navigate('CircleDetail', { circleId: item.id })
              }
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={circles.isRefetching}
              onRefresh={() => {
                circles.refetch();
              }}
              colors={[colors.orchid]}
              tintColor={colors.orchid}
            />
          }
          ListEmptyComponent={
            circles.isSuccess ? (
              <Card>
                <Text variant="h2">No Circles yet</Text>
                <Text color={colors.secondary} style={styles.emptyBody}>
                  There are no Circles in the beta yet. Pull down to check again
                  later.
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
  emptyBody: { marginTop: spacing.xs },
  padded: { paddingHorizontal: layout.pageMargin, gap: spacing.xs },
});
