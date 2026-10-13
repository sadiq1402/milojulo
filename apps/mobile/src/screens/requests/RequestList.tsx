import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Avatar,
  Button,
  Card,
  List,
  ListRow,
  Tag,
  Text,
} from '../../components';
import { formatWhen } from '../../features/activities/time';
import type { Conversation } from '../../features/chat/api';
import { useAreaNames } from '../../features/catalog/queries';
import { chatKeys } from '../../features/chat/queries';
import { modeLabels } from '../../features/modes';
import { respondRequest } from '../../features/requests/api';
import { useRequests } from '../../features/requests/queries';
import type { MemberParams } from '../../navigation/types';
import { colors, fontFamily, fonts, layout, spacing } from '../../theme';
import { JoinRequestCard } from '../activities/JoinRequestCard';

// The Inbox's Requests tab: incoming ones to answer (Connection Requests, then Join Requests to
// my Activities), then the caller's own still pending.
export function RequestList() {
  const navigation = useNavigation<NativeStackNavigationProp<MemberParams>>();
  const { conversations, joinRequests, waiting, sent, joinWaiting, joinSent } =
    useRequests();
  const areas = useAreaNames();
  const areaOf = (c: Conversation) =>
    (c.otherAreaId && areas.data?.[c.otherAreaId]) || undefined;
  const openActivity = (activityId: string) =>
    navigation.navigate('ActivityDetail', { activityId });

  if (conversations.isError || joinRequests.isError) {
    return (
      <View style={styles.section}>
        <Text color={colors.danger}>We couldn't load your requests.</Text>
        <Button
          label="Try again"
          variant="text"
          compact
          onPress={() => {
            conversations.refetch();
            joinRequests.refetch();
          }}
        />
      </View>
    );
  }
  if (!conversations.isSuccess || !joinRequests.isSuccess) {
    return null;
  }
  return (
    <>
      <View style={styles.section}>
        <Text variant="bodySmall" style={styles.heading}>
          Waiting for you
        </Text>
        {waiting.length === 0 && joinWaiting.length === 0 ? (
          <Text color={colors.secondary}>
            No requests waiting for you. When someone sends you a Connection
            Request or asks to join your Activity, it shows here.
          </Text>
        ) : (
          <View style={styles.cards}>
            {waiting.map((request, i) => (
              <RequestCard
                key={request.connectionId}
                request={request}
                area={areaOf(request)}
                tone={i}
              />
            ))}
            {joinWaiting.map((request, i) => (
              <JoinRequestCard
                key={request.id}
                requestId={request.id}
                name={request.otherName}
                detail={`Asks to join ${request.activityTitle}, ${formatWhen(
                  request.activityStartsAt,
                  null,
                )}`}
                tone={waiting.length + i}
                onOpen={() => openActivity(request.activityId)}
                openLabel={`${request.otherName} asks to join ${request.activityTitle}. Open the Activity`}
                // Like a Connection Request, accepting here opens the chat.
                onAccepted={connectionId =>
                  navigation.navigate('Chat', { connectionId })
                }
              />
            ))}
          </View>
        )}
      </View>
      <View style={styles.section} testID="sent-requests">
        <Text variant="bodySmall" style={styles.heading}>
          Sent
        </Text>
        {sent.length === 0 && joinSent.length === 0 ? (
          <Text color={colors.secondary}>
            You haven't sent any requests that are still waiting.
          </Text>
        ) : (
          <List>
            {sent.map((request, i) => (
              <ListRow
                key={request.connectionId}
                title={request.otherName}
                subtitle={areaOf(request)}
                left={<Avatar name={request.otherName} tone={i + 2} />}
                right={<Tag label="Pending" />}
              />
            ))}
            {joinSent.map((request, i) => (
              <ListRow
                key={request.id}
                title={request.activityTitle}
                subtitle={`Join request, hosted by ${request.otherName}`}
                left={
                  <Avatar name={request.otherName} tone={sent.length + i + 2} />
                }
                right={<Tag label="Pending" />}
                onPress={() => openActivity(request.activityId)}
                accessibilityLabel={`${request.activityTitle}, join request to ${request.otherName}, pending`}
              />
            ))}
          </List>
        )}
      </View>
    </>
  );
}

function RequestCard({
  request,
  area,
  tone,
}: {
  request: Conversation;
  area?: string;
  tone: number;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<MemberParams>>();
  const client = useQueryClient();
  const { connectionId, otherName } = request;
  const answer = useMutation({
    mutationFn: (accept: boolean) => respondRequest(connectionId, accept),
    onSuccess: async (_, accept) => {
      // The chat reads the Connection from the list, so it must be fresh before opening.
      await client.invalidateQueries({ queryKey: chatKeys.conversations });
      if (accept) {
        navigation.navigate('Chat', { connectionId });
      }
    },
  });
  const busy = answer.isPending;

  return (
    <Card style={styles.card}>
      <View style={styles.who}>
        <Avatar name={otherName} tone={tone} />
        <View style={styles.grow}>
          <Text style={styles.name} numberOfLines={1}>
            {otherName}
          </Text>
          {area ? (
            <Text variant="bodySmall" color={colors.secondary}>
              {area}
            </Text>
          ) : null}
        </View>
        <Tag label={modeLabels[request.mode]} tone={request.mode} />
      </View>
      {request.note ? <Text>{request.note}</Text> : null}
      {answer.error ? (
        <Text
          variant="bodySmall"
          color={colors.danger}
          accessibilityLiveRegion="polite"
        >
          {answer.error.message}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Button
          label="Accept"
          accessibilityLabel={`Accept ${otherName}`}
          compact
          loading={busy && answer.variables === true}
          disabled={busy}
          onPress={() => answer.mutate(true)}
          style={styles.grow}
        />
        <Button
          label="Decline"
          accessibilityLabel={`Decline ${otherName}`}
          variant="secondary"
          compact
          loading={busy && answer.variables === false}
          disabled={busy}
          onPress={() => answer.mutate(false)}
          style={styles.grow}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  cards: { gap: layout.blockGap },
  heading: { fontFamily: fontFamily(fonts.text, '600') },
  card: { gap: spacing.sm },
  who: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1, minWidth: 0 },
  name: { fontFamily: fontFamily(fonts.text, '600') },
  actions: { flexDirection: 'row', gap: spacing.xs },
});
