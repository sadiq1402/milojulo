import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Icon, List, ListRow, Tag, Text } from '../../components';
import { formatWhen } from '../../features/activities/time';
import type { Conversation } from '../../features/chat/api';
import { chatKeys } from '../../features/chat/queries';
import { modeLabels } from '../../features/modes';
import { respondRequest } from '../../features/requests/api';
import { useRequests } from '../../features/requests/queries';
import type { MemberParams } from '../../navigation/types';
import { colors, fontFamily, fonts, layout, sizes, spacing } from '../../theme';
import { JoinRequestCard } from '../activities/JoinRequestCard';
import { AnswerCard } from './AnswerCard';
import { MemberAvatar } from '../shared/MemberAvatar';

// Sent rows start further along the avatar tones than the cards above them.
const sentToneStart = 2;

// The Inbox's Requests tab: Connection and Join Requests to answer, then the caller's own.
export function RequestList() {
  const navigation = useNavigation<NativeStackNavigationProp<MemberParams>>();
  const { conversations, joinRequests, waiting, sent, joinWaiting, joinSent } =
    useRequests();
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
            Request or a Join Request for your Activity, it shows here.
          </Text>
        ) : (
          <View style={styles.cards}>
            {waiting.map((request, i) => (
              <RequestCard
                key={request.connectionId}
                request={request}
                tone={i}
              />
            ))}
            {joinWaiting.map((request, i) => (
              <JoinRequestCard
                key={request.id}
                requestId={request.id}
                name={request.otherName}
                photoId={request.otherPhotoId}
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
                left={
                  <MemberAvatar
                    name={request.otherName}
                    photoId={request.otherPhotoId}
                    tone={sentToneStart + i}
                  />
                }
                right={
                  <View style={styles.sentTags}>
                    <Tag label={modeLabels[request.mode]} tone={request.mode} />
                    <Tag label="Pending" />
                    <Icon
                      name="chevronRight"
                      size={sizes.icon.inline}
                      color={colors.secondary}
                    />
                  </View>
                }
                onPress={() =>
                  navigation.navigate('Profile', { memberId: request.otherId })
                }
                accessibilityLabel={`${request.otherName}, ${
                  modeLabels[request.mode]
                }, pending, see their profile`}
              />
            ))}
            {joinSent.map((request, i) => (
              <ListRow
                key={request.id}
                title={request.activityTitle}
                subtitle={`Join Request, hosted by ${request.otherName}`}
                left={
                  <MemberAvatar
                    name={request.otherName}
                    photoId={request.otherPhotoId}
                    tone={sentToneStart + sent.length + i}
                  />
                }
                right={<Tag label="Waiting" />}
                onPress={() => openActivity(request.activityId)}
                accessibilityLabel={`${request.activityTitle}, Join Request to ${request.otherName}, waiting`}
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
  tone,
}: {
  request: Conversation;
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

  return (
    <AnswerCard
      name={otherName}
      photoId={request.otherPhotoId}
      tone={tone}
      tag={<Tag label={modeLabels[request.mode]} tone={request.mode} />}
      onViewProfile={() =>
        navigation.navigate('Profile', { memberId: request.otherId })
      }
      error={answer.error?.message}
      answering={answer.isPending ? answer.variables : undefined}
      onAnswer={accept => answer.mutate(accept)}
      answerLabel={verb => `${verb} ${otherName}`}
    >
      {request.note ? <Text>{request.note}</Text> : null}
    </AnswerCard>
  );
}

const styles = StyleSheet.create({
  sentTags: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  section: { gap: spacing.sm },
  cards: { gap: layout.blockGap },
  heading: { fontFamily: fontFamily(fonts.text, '600') },
});
