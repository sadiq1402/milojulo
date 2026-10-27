import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { postActivity } from '../../features/activities/api';
import { activityKeys } from '../../features/activities/queries';
import { circleKeys } from '../../features/circles/queries';
import { defaultStart } from '../../features/activities/time';
import type { MemberParams } from '../../navigation/types';
import {
  ActivityForm,
  defaultLength,
  endAfter,
  endsAtOf,
  startsAtOf,
  type FormValues,
} from './ActivityForm';

type Props = NativeStackScreenProps<MemberParams, 'CreateActivity'>;

export function CreateActivityScreen({ navigation, route }: Props) {
  const client = useQueryClient();
  // Posting from a Circle pre-selects it; the Activity still shows on the main board.
  const circle = route.params ?? null;
  const [initial] = useState<FormValues>(() => {
    const start = defaultStart();
    const startsAt = { day: start.dateKey, minutes: start.minutes };
    return {
      title: '',
      type: null,
      day: start.dateKey,
      minutes: start.minutes,
      end: endAfter(startsAt, defaultLength),
      capacity: 4,
      description: '',
      place: null,
      typedVenue: null,
    };
  });

  const post = async (values: FormValues) => {
    const activityId = await postActivity({
      title: values.title,
      type: values.type!,
      startsAt: startsAtOf(values),
      endsAt: endsAtOf(values),
      capacity: values.capacity,
      description: values.description,
      // The form refuses to submit without a place.
      place: values.place!,
      circleId: circle?.circleId ?? null,
    });
    client.invalidateQueries({ queryKey: activityKeys.all });
    // Posting to a Circle also changes its "Coming up" list.
    if (circle) {
      client.invalidateQueries({
        queryKey: circleKeys.activities(circle.circleId),
      });
    }
    navigation.replace('ActivityDetail', { activityId });
  };

  return (
    <ActivityForm
      heading="Post an Activity"
      submitLabel="Post Activity"
      initial={initial}
      circleName={circle?.circleName}
      onBack={navigation.goBack}
      onSubmit={post}
    />
  );
}
