import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Avatar,
  Button,
  List,
  ListRow,
  Screen,
  SegmentedControl,
  Text,
} from '../../components';
import type { Conversation } from '../../features/chat/api';
import { formatChatTime, previewText } from '../../features/chat/messages';
import { useConversations } from '../../features/chat/queries';
import { usePhotoUrl } from '../../features/photos/queries';
import type { MemberParams } from '../../navigation/types';
import { RequestList } from '../requests/RequestList';
import { colors, fontFamily, fonts, sizes, spacing } from '../../theme';

type Segment = 'requests' | 'chats';

export function InboxScreen() {
  const [segment, setSegment] = useState<Segment>('requests');
  return (
    <Screen>
      <Text variant="h1" accessibilityRole="header" style={styles.title}>
        Inbox
      </Text>
      <SegmentedControl
        options={[
          { value: 'requests', label: 'Requests' },
          { value: 'chats', label: 'Chats' },
        ]}
        value={segment}
        onChange={setSegment}
      />
      {segment === 'chats' ? <ChatList /> : <RequestList />}
    </Screen>
  );
}

function ChatList() {
  const navigation = useNavigation<NativeStackNavigationProp<MemberParams>>();
  const conversations = useConversations();
  const chats = (conversations.data ?? []).filter(
    c => c.status === 'accepted' || c.status === 'closed',
  );

  if (conversations.isError) {
    return (
      <View style={styles.error}>
        <Text color={colors.danger}>We couldn't load your chats.</Text>
        <Button
          label="Try again"
          variant="text"
          compact
          onPress={() => conversations.refetch()}
        />
      </View>
    );
  }
  if (conversations.isSuccess && chats.length === 0) {
    return (
      <Text color={colors.secondary}>
        No chats yet. When someone accepts your Connection Request, or you
        accept theirs, you can chat here.
      </Text>
    );
  }
  return (
    <List>
      {chats.map((chat, i) => (
        <ChatRow
          key={chat.connectionId}
          chat={chat}
          tone={i}
          onPress={() =>
            navigation.navigate('Chat', { connectionId: chat.connectionId })
          }
        />
      ))}
    </List>
  );
}

function ChatRow({
  chat,
  tone,
  onPress,
}: {
  chat: Conversation;
  tone: number;
  onPress: () => void;
}) {
  const preview =
    chat.status === 'closed'
      ? 'Closed'
      : chat.lastMessage
      ? previewText(chat.lastMessage)
      : 'Say hello';
  const unread = chat.unreadCount > 0;
  const photo = usePhotoUrl(chat.otherPhotoId);
  return (
    <ListRow
      title={chat.otherName}
      subtitle={preview}
      onPress={onPress}
      accessibilityLabel={[
        chat.otherName,
        preview,
        unread ? `${chat.unreadCount} unread` : '',
      ]
        .filter(Boolean)
        .join(', ')}
      left={
        <Avatar
          name={chat.otherName}
          tone={tone}
          uri={photo.data ?? undefined}
        />
      }
      right={
        <View style={styles.meta}>
          {chat.lastMessage ? (
            <Text
              variant="caption"
              color={colors.secondary}
              style={styles.time}
            >
              {formatChatTime(chat.lastMessage.at)}
            </Text>
          ) : null}
          <View style={[styles.dot, unread && styles.dotOn]} />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  title: { paddingTop: spacing.sm },
  meta: { alignItems: 'flex-end', gap: spacing.xxs },
  error: { gap: spacing.xs },
  time: { fontFamily: fontFamily(fonts.text, '500') },
  dot: {
    width: sizes.unreadDot,
    height: sizes.unreadDot,
    borderRadius: sizes.unreadDot / 2,
  },
  dotOn: { backgroundColor: colors.orchid },
});
