import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { postActivity } from '../../features/activities/api';
import { activityKeys } from '../../features/activities/queries';
import { defaultStart } from '../../features/activities/time';
import type { MemberParams } from '../../navigation/types';
import {
  ActivityForm,
  defaultLength,
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
    return {
      title: '',
      type: null,
      areaId: null,
      day: start.dateKey,
      minutes: start.minutes,
      length: defaultLength,
      capacity: 4,
      description: '',
      venueDetail: '',
    };
  });

  const post = async (values: FormValues) => {
    const activityId = await postActivity({
      title: values.title,
      type: values.type!,
      areaId: values.areaId!,
      startsAt: startsAtOf(values),
      endsAt: endsAtOf(values),
      capacity: values.capacity,
      description: values.description,
      venueDetail: values.venueDetail,
      circleId: circle?.circleId ?? null,
    });
    client.invalidateQueries({ queryKey: activityKeys.all });
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
