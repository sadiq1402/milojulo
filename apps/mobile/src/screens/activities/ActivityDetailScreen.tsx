import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BottomSheet,
  Button,
  Card,
  ErrorText,
  Icon,
  IconButton,
  type IconName,
  List,
  ListRow,
  Tag,
  Text,
  TopBar,
} from '../../components';
import { cancelActivity } from '../../features/activities/api';
import {
  activityTypeLabels,
  directionsUrl,
  hostLine,
  spotsLeftLabel,
  type Activity,
  type ActivityStatus,
  type JoinRequestStatus,
} from '../../features/activities/model';
import {
  activityKeys,
  useActivity,
  useAskToJoin,
  useJoinRequests,
  useWithdrawJoinRequest,
} from '../../features/activities/queries';
import { formatWhen } from '../../features/activities/time';
import { useAreaName, useAreaNames } from '../../features/catalog/queries';
import { chatKeys } from '../../features/chat/queries';
import type { MemberParams } from '../../navigation/types';
import {
  colors,
  fontFamily,
  fonts,
  layout,
  radius,
  shadow,
  sizes,
  spacing,
} from '../../theme';
import { JoinRequestCard } from './JoinRequestCard';
import { MemberAvatar } from '../shared/MemberAvatar';

type Props = NativeStackScreenProps<MemberParams, 'ActivityDetail'>;

const statusNotes: Record<Exclude<ActivityStatus, 'open'>, string> = {
  cancelled: 'This Activity was cancelled.',
  expired: 'This Activity is over.',
  removed: 'This Activity was taken down by MiloJulo.',
};

// No asking again after these: one Join Request per Activity.
const closedRequestNotes: Record<
  Exclude<JoinRequestStatus, 'requested' | 'accepted'>,
  string
> = {
  declined: "Your request to join wasn't accepted this time.",
  cancelled: 'You cancelled your request to join.',
  withdrawn: 'You withdrew from this Activity.',
};

export function ActivityDetailScreen({ navigation, route }: Props) {
  const { activityId } = route.params;
  const activity = useActivity(activityId);
  const client = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const data = activity.data;
  const hostCanAct = data?.isMine && data.status === 'open';
  // The chat reads its Connection from the chat list, so refresh that first.
  const openChat = async (connectionId: string) => {
    await client.invalidateQueries({ queryKey: chatKeys.conversations });
    navigation.navigate('Chat', { connectionId });
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <TopBar
        onBack={navigation.goBack}
        right={
          data && !data.isMine ? (
            <IconButton
              icon="more"
              accessibilityLabel="Activity menu"
              onPress={() => setMenuOpen(true)}
            />
          ) : null
        }
      />
      {data && !data.isMine ? (
        <BottomSheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
          <Button
            label="Report this Activity"
            variant="secondary"
            onPress={() => {
              setMenuOpen(false);
              navigation.navigate('Report', {
                targetType: 'activity',
                targetId: data.id,
                memberId: data.hostId,
                memberName: data.hostName,
              });
            }}
          />
        </BottomSheet>
      ) : null}
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
            onOpenChat={openChat}
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
          {data.isMine ? null : (
            <JoinActions activity={data} onOpenChat={openChat} />
          )}
        </>
      ) : (
        <ActivityIndicator color={colors.orchid} />
      )}
    </SafeAreaView>
  );
}

function venueNote(activity: Activity): string {
  if (activity.isMine) {
    return 'No exact spot added yet.';
  }
  return activity.myRequest?.status === 'accepted'
    ? "The host hasn't added the exact spot yet."
    : 'The exact spot is shared once the host accepts you.';
}

function ActivityBody({
  activity,
  onSafetyTips,
  onOpenChat,
}: {
  activity: Activity;
  onSafetyTips: () => void;
  onOpenChat: (connectionId: string) => void;
}) {
  const areas = useAreaNames();
  const taken = activity.capacity - activity.spotsLeft;
  const areaName = areas.data?.[activity.areaId] ?? '';
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
        {activity.venueDetail ? (
          <Fact
            icon="pin"
            title={activity.venueDetail}
            note={areaName}
            action={
              <Directions url={directionsUrl(activity.venueDetail, areaName)} />
            }
          />
        ) : (
          <Fact icon="pin" title={areaName} note={venueNote(activity)} />
        )}
        <Fact
          icon="circles"
          title={`${taken} of ${activity.capacity} spots taken`}
        />
        {activity.circleName ? (
          <Fact icon="circles" title="Circle" note={activity.circleName} />
        ) : null}
      </View>
      <Card style={styles.host}>
        <MemberAvatar photoId={activity.hostPhotoId} name={activity.hostName} />
        <Text variant="title">
          {activity.isMine ? "You're hosting" : hostLine(activity)}
        </Text>
      </Card>
      {activity.description ? <Text>{activity.description}</Text> : null}
      {activity.isMine ? (
        <HostJoinRequests activity={activity} onOpenChat={onOpenChat} />
      ) : null}
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
          <View style={styles.start}>
            <Button
              label="Read safety tips"
              variant="text"
              compact
              onPress={onSafetyTips}
            />
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}

function Fact({
  icon,
  title,
  note,
  action,
}: {
  icon: IconName;
  title: string;
  note?: string;
  action?: React.ReactNode;
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
      {action}
    </View>
  );
}

function Directions({ url }: { url: string }) {
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      accessibilityRole="button"
      accessibilityLabel="Directions"
      accessibilityHint="Opens Google Maps"
      hitSlop={(sizes.hitArea - directionsHeight) / 2}
      style={({ pressed }) => [styles.directions, pressed && styles.pressed]}
    >
      <Icon
        name="directions"
        size={sizes.icon.tiny}
        color={colors.orchidDark}
      />
      <Text
        variant="label"
        color={colors.orchidDark}
        style={styles.directionsLabel}
      >
        Directions
      </Text>
    </Pressable>
  );
}

// The phone's clock only decides what to offer; the database checks the start itself.
function beforeStart(activity: Activity): boolean {
  return (
    activity.status === 'open' && Date.parse(activity.startsAt) > Date.now()
  );
}

// Accepting here keeps the host on the Activity, as several may be waiting (decision 26).
function HostJoinRequests({
  activity,
  onOpenChat,
}: {
  activity: Activity;
  onOpenChat: (connectionId: string) => void;
}) {
  const requests = useJoinRequests(activity.id);
  const areaName = useAreaName();

  if (requests.isError) {
    return (
      <View style={styles.section}>
        <Text color={colors.danger}>{requests.error.message}</Text>
        <Button
          label="Try again"
          variant="text"
          compact
          onPress={() => requests.refetch()}
        />
      </View>
    );
  }
  if (!requests.data) {
    return null;
  }
  const waiting = requests.data.filter(r => r.status === 'requested');
  const going = requests.data.filter(r => r.status === 'accepted');
  const canAnswer = beforeStart(activity);

  return (
    <>
      {activity.status === 'open' || waiting.length > 0 ? (
        <View style={styles.section} testID="join-requests">
          <Text variant="bodySmall" style={styles.heading}>
            Join Requests
          </Text>
          {waiting.length === 0 ? (
            <Text color={colors.secondary}>
              No one is waiting. When someone asks to join, they show here.
            </Text>
          ) : (
            waiting.map((request, i) => (
              <JoinRequestCard
                key={request.id}
                requestId={request.id}
                name={request.requesterName}
                photoId={request.requesterPhotoId}
                detail={areaName(request.requesterAreaId)}
                tone={i}
                canAnswer={canAnswer}
              />
            ))
          )}
        </View>
      ) : null}
      <View style={styles.section} testID="going">
        <Text variant="bodySmall" style={styles.heading}>
          Going
        </Text>
        {going.length === 0 ? (
          <Text color={colors.secondary}>No one has joined yet.</Text>
        ) : (
          <List>
            {going.map(
              (
                {
                  id,
                  requesterName,
                  requesterPhotoId,
                  requesterAreaId,
                  connectionId,
                },
                i,
              ) => (
                <ListRow
                  key={id}
                  title={requesterName}
                  subtitle={areaName(requesterAreaId)}
                  left={
                    <MemberAvatar
                      name={requesterName}
                      photoId={requesterPhotoId}
                      tone={waiting.length + i}
                    />
                  }
                  right={
                    connectionId ? (
                      <Button
                        label="Open chat"
                        accessibilityLabel={`Open chat with ${requesterName}`}
                        variant="secondary"
                        compact
                        onPress={() => onOpenChat(connectionId)}
                      />
                    ) : undefined
                  }
                />
              ),
            )}
          </List>
        )}
      </View>
    </>
  );
}

// Everyone but the host: ask, wait, go, or a note on how it ended.
function JoinActions({
  activity,
  onOpenChat,
}: {
  activity: Activity;
  onOpenChat: (connectionId: string) => void;
}) {
  const ask = useAskToJoin(activity.id);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const request = activity.myRequest;
  const { connectionId, hostName } = activity;
  const canChange = beforeStart(activity);

  let content: React.ReactNode;
  if (!request) {
    if (activity.status !== 'open') {
      return null;
    }
    content = !canChange ? (
      <Note text="This Activity has already started." />
    ) : activity.spotsLeft <= 0 ? (
      <Note text="No spots left. This Activity is full." />
    ) : (
      <>
        <Button
          label="Ask to join"
          loading={ask.isPending}
          onPress={() => ask.mutate()}
        />
        {ask.error ? <ErrorText text={ask.error.message} /> : null}
      </>
    );
  } else if (request.status === 'requested') {
    content = canChange ? (
      <>
        <View style={styles.state}>
          <Tag label="Requested" tone="match" />
          <Text
            variant="bodySmall"
            color={colors.secondary}
            style={styles.grow}
          >
            Waiting for {hostName} to answer.
          </Text>
        </View>
        <Button
          label="Cancel request"
          variant="secondary"
          onPress={() => setWithdrawOpen(true)}
        />
      </>
    ) : (
      <Note
        text={`${hostName} didn't answer your Join Request before the start.`}
      />
    );
  } else if (request.status === 'accepted') {
    content = (
      <>
        <View style={styles.state}>
          <Tag label="Going" tone="match" />
          <Text
            variant="bodySmall"
            color={colors.secondary}
            style={styles.grow}
          >
            {hostName} accepted you.
          </Text>
        </View>
        {connectionId ? (
          <Button
            label="Open chat"
            accessibilityLabel={`Open chat with ${hostName}`}
            onPress={() => onOpenChat(connectionId)}
          />
        ) : (
          <Note text={`Your chat with ${hostName} was closed.`} />
        )}
        {canChange ? (
          <Button
            label="Withdraw"
            variant="text"
            onPress={() => setWithdrawOpen(true)}
          />
        ) : null}
      </>
    );
  } else {
    content = <Note text={closedRequestNotes[request.status]} />;
  }

  return (
    <View style={styles.action}>
      {content}
      {request ? (
        <WithdrawSheet
          visible={withdrawOpen}
          requestId={request.id}
          accepted={request.status === 'accepted'}
          hostName={hostName}
          onClose={() => setWithdrawOpen(false)}
        />
      ) : null}
    </View>
  );
}

function Note({ text }: { text: string }) {
  return (
    <Text
      color={colors.secondary}
      accessibilityLiveRegion="polite"
      style={styles.note}
    >
      {text}
    </Text>
  );
}

// Cancel and Withdraw are both final: one Join Request per Activity.
function WithdrawSheet({
  visible,
  requestId,
  accepted,
  hostName,
  onClose,
}: {
  visible: boolean;
  requestId: string;
  accepted: boolean;
  hostName: string;
  onClose: () => void;
}) {
  const withdraw = useWithdrawJoinRequest();
  const dismiss = () => {
    withdraw.reset();
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={dismiss}>
      <View style={styles.sheet} testID="confirm-withdraw">
        <Text variant="h2">
          {accepted ? 'Withdraw from this Activity?' : 'Cancel your request?'}
        </Text>
        <Text color={colors.secondary}>
          {accepted
            ? `Your spot opens up for someone else and you can't ask to join again. Your chat with ${hostName} stays.`
            : "You can't ask to join this Activity again."}
        </Text>
        <Button
          label={accepted ? 'Yes, withdraw' : 'Yes, cancel my request'}
          variant="danger"
          loading={withdraw.isPending}
          onPress={() => withdraw.mutate(requestId, { onSuccess: onClose })}
        />
        {withdraw.error ? <ErrorText text={withdraw.error.message} /> : null}
        <Button
          label={accepted ? 'Keep my spot' : 'Keep my request'}
          variant="text"
          onPress={dismiss}
        />
      </View>
    </BottomSheet>
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
        {error ? <ErrorText text={error} /> : null}
        <Button label="Keep it" variant="text" onPress={dismiss} />
      </View>
    </BottomSheet>
  );
}

// The mockup's pill is 36 high; hit slop takes it to the 48 hit area.
const directionsHeight = 36;

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
  directions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    minHeight: directionsHeight,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    backgroundColor: colors.tint,
  },
  directionsLabel: { fontSize: 14 },
  pressed: { opacity: 0.7 },
  start: { alignSelf: 'flex-start' },
  host: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  section: { gap: spacing.sm },
  heading: { fontFamily: fontFamily(fonts.text, '600') },
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
  state: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  note: { paddingVertical: spacing.sm },
  sheet: { gap: spacing.xs },
});
