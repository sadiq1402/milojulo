import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BottomSheet,
  Button,
  ErrorText,
  List,
  ListRow,
  Tag,
  Text,
  TopBar,
} from '../../components';
import { memberCountLabel, type Circle } from '../../features/circles/model';
import {
  useCircle,
  useCircleActivities,
  useCircleMembers,
  useJoinCircle,
  useLeaveCircle,
} from '../../features/circles/queries';
import {
  useAreaName,
  useAreaNames,
  useTagNames,
} from '../../features/catalog/queries';
import type { MemberParams } from '../../navigation/types';
import { colors, layout, radius, shadow, spacing } from '../../theme';
import { ActivityCard } from '../activities/ActivityCard';
import { MemberAvatar } from '../shared/MemberAvatar';

type Props = NativeStackScreenProps<MemberParams, 'CircleDetail'>;

export function CircleDetailScreen({ navigation, route }: Props) {
  const { circleId } = route.params;
  const circle = useCircle(circleId);
  const data = circle.data;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <TopBar onBack={navigation.goBack} />
      {circle.isError ? (
        <View style={styles.message}>
          <Text color={colors.danger}>{circle.error.message}</Text>
          <Button
            label="Try again"
            variant="text"
            compact
            onPress={() => circle.refetch()}
          />
        </View>
      ) : data === null ? (
        <View style={styles.message}>
          <Text color={colors.secondary}>
            This Circle isn't available any more.
          </Text>
        </View>
      ) : data ? (
        <>
          <CircleBody
            circle={data}
            onOpenActivity={activityId =>
              navigation.navigate('ActivityDetail', { activityId })
            }
            onOpenMember={memberId =>
              navigation.navigate('Profile', { memberId })
            }
          />
          <CircleActions
            circle={data}
            onPost={() =>
              navigation.navigate('CreateActivity', {
                circleId: data.id,
                circleName: data.name,
              })
            }
          />
        </>
      ) : (
        <ActivityIndicator color={colors.orchid} />
      )}
    </SafeAreaView>
  );
}

function CircleBody({
  circle,
  onOpenActivity,
  onOpenMember,
}: {
  circle: Circle;
  onOpenActivity: (activityId: string) => void;
  onOpenMember: (memberId: string) => void;
}) {
  const areas = useAreaNames();
  const tags = useTagNames();
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <View style={styles.tags}>
        <Tag label={areas.data?.[circle.areaId] ?? ''} />
        <Tag label={tags.data?.[circle.tagId] ?? ''} />
        {circle.iAmMember ? <Tag label="Joined" tone="match" /> : null}
      </View>
      <Text variant="h1" accessibilityRole="header">
        {circle.name}
      </Text>
      <Text color={colors.secondary}>
        {memberCountLabel(circle.memberCount)}
      </Text>
      {circle.description ? <Text>{circle.description}</Text> : null}
      <CircleActivities circleId={circle.id} onOpenActivity={onOpenActivity} />
      {circle.iAmMember ? (
        <CircleMembers circleId={circle.id} onOpenMember={onOpenMember} />
      ) : null}
    </ScrollView>
  );
}

function CircleActivities({
  circleId,
  onOpenActivity,
}: {
  circleId: string;
  onOpenActivity: (activityId: string) => void;
}) {
  const activities = useCircleActivities(circleId);
  const areas = useAreaNames();
  if (!activities.data || activities.data.length === 0) {
    return null;
  }
  return (
    <View style={styles.section} testID="circle-activities">
      <Text variant="h2" accessibilityRole="header">
        Coming up
      </Text>
      {activities.data.map(activity => (
        <ActivityCard
          key={activity.id}
          activity={activity}
          areaName={areas.data?.[activity.areaId] ?? ''}
          onPress={() => onOpenActivity(activity.id)}
        />
      ))}
    </View>
  );
}

function CircleMembers({
  circleId,
  onOpenMember,
}: {
  circleId: string;
  onOpenMember: (memberId: string) => void;
}) {
  const members = useCircleMembers(circleId);
  const areaName = useAreaName();
  return (
    <View style={styles.section} testID="circle-members">
      <Text variant="h2" accessibilityRole="header">
        Members
      </Text>
      <Text variant="bodySmall" color={colors.secondary}>
        Tap a member to see their profile and send a request. Chat opens one to
        one once they accept.
      </Text>
      {members.data && members.data.length > 0 ? (
        <List>
          {members.data.map((member, i) => (
            <ListRow
              key={member.id}
              title={member.name}
              subtitle={areaName(member.areaId)}
              left={
                <MemberAvatar
                  name={member.name}
                  photoId={member.coverPhotoId}
                  tone={i}
                />
              }
              onPress={() => onOpenMember(member.id)}
              accessibilityLabel={`${member.name}, see their profile`}
            />
          ))}
        </List>
      ) : (
        <Text color={colors.secondary}>No one else to show here yet.</Text>
      )}
    </View>
  );
}

function CircleActions({
  circle,
  onPost,
}: {
  circle: Circle;
  onPost: () => void;
}) {
  const join = useJoinCircle(circle.id);
  const [leaveOpen, setLeaveOpen] = useState(false);

  return (
    <View style={styles.action}>
      {circle.iAmMember ? (
        <>
          <Button label="Post an activity to this circle" onPress={onPost} />
          <Button
            label="Leave Circle"
            variant="text"
            onPress={() => setLeaveOpen(true)}
          />
          <LeaveSheet
            visible={leaveOpen}
            circleId={circle.id}
            name={circle.name}
            onClose={() => setLeaveOpen(false)}
          />
        </>
      ) : (
        <>
          <Button
            label="Join Circle"
            loading={join.isPending}
            onPress={() => join.mutate()}
          />
          {join.error ? <ErrorText text={join.error.message} /> : null}
        </>
      )}
    </View>
  );
}

function LeaveSheet({
  visible,
  circleId,
  name,
  onClose,
}: {
  visible: boolean;
  circleId: string;
  name: string;
  onClose: () => void;
}) {
  const leave = useLeaveCircle(circleId);
  const dismiss = () => {
    leave.reset();
    onClose();
  };
  return (
    <BottomSheet visible={visible} onClose={dismiss}>
      <View style={styles.sheet} testID="confirm-leave">
        <Text variant="h2">Leave {name}?</Text>
        <Text color={colors.secondary}>
          You'll stop seeing its members and can't post to it until you join
          again. Activities you already posted stay as they are.
        </Text>
        <Button
          label="Yes, leave"
          variant="danger"
          loading={leave.isPending}
          onPress={() => leave.mutate(undefined, { onSuccess: onClose })}
        />
        {leave.error ? <ErrorText text={leave.error.message} /> : null}
        <Button label="Stay in the Circle" variant="text" onPress={dismiss} />
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
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs },
  section: { gap: spacing.sm },
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
