import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Avatar,
  BottomSheet,
  Button,
  Card,
  Icon,
  type IconName,
  Tag,
  Text,
  TopBar,
} from '../../components';
import { cancelActivity } from '../../features/activities/api';
import {
  activityTypeLabels,
  hostLine,
  spotsLeftLabel,
  type Activity,
  type ActivityStatus,
} from '../../features/activities/model';
import { activityKeys, useActivity } from '../../features/activities/queries';
import { formatWhen } from '../../features/activities/time';
import { useAreaNames } from '../../features/catalog/queries';
import type { MemberParams } from '../../navigation/types';
import { colors, layout, radius, shadow, sizes, spacing } from '../../theme';

type Props = NativeStackScreenProps<MemberParams, 'ActivityDetail'>;

const statusNotes: Record<Exclude<ActivityStatus, 'open'>, string> = {
  cancelled: 'This Activity was cancelled.',
  expired: 'This Activity is over.',
  removed: 'This Activity was taken down by MiloJulo.',
};

export function ActivityDetailScreen({ navigation, route }: Props) {
  const { activityId } = route.params;
  const activity = useActivity(activityId);
  const [cancelOpen, setCancelOpen] = useState(false);
  const data = activity.data;
  const hostCanAct = data?.isMine && data.status === 'open';

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <TopBar onBack={navigation.goBack} />
      {activity.isError ? (
        <View style={styles.message}>
          <Text color={colors.danger}>{activity.error.message}</Text>
          <Button
            label="Try again"
            variant="text"
            compact
            onPress={() => activity.refetch()}
          />
        </View>
      ) : data === null ? (
        <View style={styles.message}>
          <Text color={colors.secondary}>
            This Activity isn't available any more.
          </Text>
        </View>
      ) : data ? (
        <>
          <ActivityBody
            activity={data}
            onSafetyTips={() => navigation.navigate('SafetyCentre')}
          />
          {hostCanAct ? (
            <View style={styles.action}>
              <Button
                label="Edit"
                variant="secondary"
                onPress={() =>
                  navigation.navigate('EditActivity', { activityId })
                }
              />
              <Button
                label="Cancel Activity"
                variant="text"
                onPress={() => setCancelOpen(true)}
              />
              <CancelSheet
                visible={cancelOpen}
                activityId={activityId}
                onClose={() => setCancelOpen(false)}
                onCancelled={() => {
                  setCancelOpen(false);
                  navigation.goBack();
                }}
              />
            </View>
          ) : null}
          {/* Non-hosts get the Join Request button here with #47. */}
        </>
      ) : (
        <ActivityIndicator color={colors.orchid} />
      )}
    </SafeAreaView>
  );
}

function ActivityBody({
  activity,
  onSafetyTips,
}: {
  activity: Activity;
  onSafetyTips: () => void;
}) {
  const areas = useAreaNames();
  const taken = activity.capacity - activity.spotsLeft;
  return (
    <ScrollView contentContainerStyle={styles.body}>
      {activity.status !== 'open' ? (
        <View style={styles.status} accessibilityLiveRegion="polite">
          <Text color={colors.warnInk}>{statusNotes[activity.status]}</Text>
        </View>
      ) : null}
      <View style={styles.tags}>
        <Tag label={activityTypeLabels[activity.type]} />
        <Tag label={spotsLeftLabel(activity.spotsLeft)} tone="butter" />
      </View>
      <Text variant="h1" accessibilityRole="header">
        {activity.title}
      </Text>
      <View style={styles.facts}>
        <Fact
          icon="clock"
          title={formatWhen(activity.startsAt, activity.endsAt)}
        />
        <Fact
          icon="pin"
          title={areas.data?.[activity.areaId] ?? ''}
          note={
            activity.isMine
              ? activity.venueDetail ?? 'No exact spot added yet.'
              : activity.venueDetail ??
                'The exact spot is shared once the host accepts you.'
          }
        />
        <Fact
          icon="circles"
          title={`${taken} of ${activity.capacity} spots taken`}
        />
      </View>
      <Card style={styles.host}>
        <Avatar name={activity.hostName} />
        <Text variant="title">
          {activity.isMine ? "You're hosting" : hostLine(activity)}
        </Text>
      </Card>
      {activity.description ? <Text>{activity.description}</Text> : null}
      <Card style={styles.safety}>
        <Icon
          name="shieldCheck"
          size={sizes.icon.inline}
          color={colors.orchid}
        />
        <View style={styles.grow}>
          <Text variant="bodySmall" color={colors.orchidDark}>
            Meet in a public place and tell a friend where you'll be.
          </Text>
          <Button
            label="Read safety tips"
            variant="text"
            compact
            onPress={onSafetyTips}
          />
        </View>
      </Card>
    </ScrollView>
  );
}

function Fact({
  icon,
  title,
  note,
}: {
  icon: IconName;
  title: string;
  note?: string;
}) {
  return (
    <View style={styles.fact}>
      <Icon name={icon} color={colors.orchid} />
      <View style={styles.grow}>
        <Text variant="title">{title}</Text>
        {note ? (
          <Text variant="bodySmall" color={colors.secondary}>
            {note}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function CancelSheet({
  visible,
  activityId,
  onClose,
  onCancelled,
}: {
  visible: boolean;
  activityId: string;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const client = useQueryClient();
  const cancel = useMutation({
    mutationFn: () => cancelActivity(activityId),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: activityKeys.all });
      onCancelled();
    },
  });
  const error = cancel.error?.message;
  const dismiss = () => {
    cancel.reset();
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={dismiss}>
      <View style={styles.sheet} testID="confirm-cancel">
        <Text variant="h2">Cancel this Activity?</Text>
        <Text color={colors.secondary}>
          It comes off the board straight away. This can't be undone.
        </Text>
        <Button
          label="Yes, cancel it"
          variant="danger"
          loading={cancel.isPending}
          onPress={() => cancel.mutate()}
        />
        {error ? (
          <Text
            variant="bodySmall"
            color={colors.danger}
            accessibilityLiveRegion="polite"
          >
            {error}
          </Text>
        ) : null}
        <Button label="Keep it" variant="text" onPress={dismiss} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  message: { paddingHorizontal: layout.pageMargin, gap: spacing.xs },
  body: {
    paddingHorizontal: layout.pageMargin,
    paddingBottom: layout.sectionGap,
    gap: layout.blockGap,
  },
  status: {
    backgroundColor: colors.warnTint,
    borderRadius: radius.r16,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  tags: { flexDirection: 'row', gap: spacing.xxs },
  facts: { gap: spacing.sm },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  grow: { flex: 1 },
  host: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  safety: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.selected,
  },
  action: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.r28,
    borderTopRightRadius: radius.r28,
    paddingTop: spacing.sm,
    paddingHorizontal: layout.pageMargin,
    gap: spacing.xs,
    ...shadow('tabBar'),
  },
  sheet: { gap: spacing.xs },
});
