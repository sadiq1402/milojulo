import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text, TopBar } from '../../components';
import { updateActivity } from '../../features/activities/api';
import type {
  Activity,
  ActivityChanges,
} from '../../features/activities/model';
import { activityKeys, useActivity } from '../../features/activities/queries';
import { indiaParts } from '../../features/activities/time';
import type { MemberParams } from '../../navigation/types';
import { colors, layout, spacing } from '../../theme';
import {
  ActivityForm,
  endsAtOf,
  startsAtOf,
  type FormValues,
} from './ActivityForm';

type Props = NativeStackScreenProps<MemberParams, 'EditActivity'>;

function endOf(endsAt: string) {
  const end = indiaParts(new Date(endsAt));
  return { day: end.dateKey, minutes: end.minutes };
}

function valuesOf(activity: Activity): FormValues {
  const start = indiaParts(new Date(activity.startsAt));
  return {
    title: activity.title,
    type: activity.type,
    day: start.dateKey,
    minutes: start.minutes,
    end: activity.endsAt ? endOf(activity.endsAt) : null,
    capacity: activity.capacity,
    description: activity.description ?? '',
    place: activity.venue,
    typedVenue: activity.venue ? null : activity.venueDetail,
  };
}

const sameInstant = (a: string | null, b: string | null) =>
  a === b || (a !== null && b !== null && Date.parse(a) === Date.parse(b));

// Only what the host changed; the database keeps the rest.
function changesFrom(before: FormValues, after: FormValues): ActivityChanges {
  const changes: ActivityChanges = {};
  if (after.title.trim() !== before.title) {
    changes.title = after.title;
  }
  if (after.description.trim() !== before.description) {
    changes.description = after.description;
  }
  if (after.capacity !== before.capacity) {
    changes.capacity = after.capacity;
  }
  if (!sameInstant(startsAtOf(after), startsAtOf(before))) {
    changes.startsAt = startsAtOf(after);
  }
  const endsAt = endsAtOf(after);
  if (endsAt !== null && !sameInstant(endsAt, endsAtOf(before))) {
    changes.endsAt = endsAt;
  }
  if (after.place && after.place !== before.place) {
    changes.place = after.place;
  }
  return changes;
}

export function EditActivityScreen({ navigation, route }: Props) {
  const { activityId } = route.params;
  const client = useQueryClient();
  const activity = useActivity(activityId);

  if (!activity.data) {
    return (
      <SafeAreaView edges={['top']} style={styles.screen}>
        <TopBar onBack={navigation.goBack} />
        <View style={styles.message}>
          {activity.isError ? (
            <>
              <Text color={colors.danger}>{activity.error.message}</Text>
              <Button
                label="Try again"
                variant="text"
                compact
                onPress={() => activity.refetch()}
              />
            </>
          ) : activity.isPending ? (
            <ActivityIndicator color={colors.orchid} />
          ) : (
            <Text color={colors.secondary}>
              This Activity isn't available any more.
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const initial = valuesOf(activity.data);
  const save = async (values: FormValues) => {
    const changes = changesFrom(initial, values);
    if (Object.keys(changes).length > 0) {
      await updateActivity(activityId, changes);
      client.invalidateQueries({ queryKey: activityKeys.all });
    }
    navigation.goBack();
  };

  return (
    <ActivityForm
      heading="Edit Activity"
      submitLabel="Save changes"
      initial={initial}
      onBack={navigation.goBack}
      onSubmit={save}
      editing
      locked={activity.data.isLocked}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  message: { paddingHorizontal: layout.pageMargin, gap: spacing.xs },
});
