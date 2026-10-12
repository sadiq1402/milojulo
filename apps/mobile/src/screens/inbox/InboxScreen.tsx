import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
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
import { fetchConversations, type Conversation } from '../../features/chat/api';
import { formatChatTime, previewText } from '../../features/chat/messages';
import { conversationsKey } from '../../features/chat/useChat';
import type { MemberParams } from '../../navigation/types';
import { colors, fontFamily, fonts, sizes, spacing } from '../../theme';

type Segment = 'requests' | 'chats';

// Requests arrive with the Connection Requests screens (#41); until then the tab opens on Chats.
export function InboxScreen() {
  const [segment, setSegment] = useState<Segment>('chats');
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
      {segment === 'chats' ? (
        <ChatList />
      ) : (
        <Text color={colors.secondary}>
          Connection Requests will show here soon.
        </Text>
      )}
    </Screen>
  );
}

function ChatList() {
  const navigation = useNavigation<NativeStackNavigationProp<MemberParams>>();
  const conversations = useQuery({
    queryKey: conversationsKey,
    queryFn: fetchConversations,
  });
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
      left={<Avatar name={chat.otherName} tone={tone} />}
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
