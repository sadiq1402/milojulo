import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Icon, IconButton, Text } from '../../components';
import { useSession } from '../../features/auth/SessionProvider';
import { fetchAreaNames } from '../../features/catalog/api';
import {
  blockMember,
  closeConnection,
  fetchConversations,
  setMuted,
} from '../../features/chat/api';
import {
  conversationsKey,
  useChat,
  type ChatItem,
} from '../../features/chat/useChat';
import type { MemberParams } from '../../navigation/types';
import {
  colors,
  layout,
  radius,
  sizes,
  spacing,
  textStyles,
} from '../../theme';
import { ChatMenu } from './ChatMenu';
import { MessageBubble } from './MessageBubble';

export function ChatScreen({
  navigation,
  route,
}: NativeStackScreenProps<MemberParams, 'Chat'>) {
  const { connectionId } = route.params;
  const myId = useSession().session!.user.id;
  const client = useQueryClient();
  const conversations = useQuery({
    queryKey: conversationsKey,
    queryFn: fetchConversations,
  });
  const areas = useQuery({
    queryKey: ['areas'],
    queryFn: fetchAreaNames,
    staleTime: Infinity,
  });
  const chat = useChat(connectionId, myId);
  const [draft, setDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const conversation = conversations.data?.find(
    c => c.connectionId === connectionId,
  );
  const name = conversation?.otherName ?? '';
  const open = conversation?.status === 'accepted';
  const refresh = () =>
    client.invalidateQueries({ queryKey: conversationsKey });

  // "Seen" goes under my newest message once the other side's read position reaches it.
  const myNewest = [...chat.items]
    .reverse()
    .find(m => m.senderId === myId && m.delivery === 'sent');
  const seenId =
    myNewest &&
    chat.otherLastReadAt &&
    chat.otherLastReadAt >= myNewest.createdAt
      ? myNewest.id
      : undefined;

  const send = () => {
    const body = draft.trim();
    if (body) {
      chat.send(body);
      setDraft('');
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.header}>
        <IconButton
          icon="back"
          accessibilityLabel="Back"
          onPress={navigation.goBack}
        />
        <Avatar name={name || ' '} size="chatHeader" />
        <View style={styles.who}>
          <Text variant="title" accessibilityRole="header" numberOfLines={1}>
            {name}
          </Text>
          {conversation?.otherAreaId ? (
            <Text variant="caption" color={colors.secondary}>
              {areas.data?.[conversation.otherAreaId] ?? ''}
            </Text>
          ) : null}
        </View>
        <IconButton
          icon="more"
          accessibilityLabel="Chat menu"
          onPress={() => setMenuOpen(true)}
        />
      </View>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FlatList
          data={chat.items}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messages}
          ListHeaderComponent={<SafetyNote />}
          renderItem={({ item }: { item: ChatItem }) => (
            <MessageBubble
              item={item}
              mine={item.senderId === myId}
              seen={item.id === seenId}
              onRetry={() => chat.retry(item.id)}
            />
          )}
        />
        {open ? (
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message"
              placeholderTextColor={colors.secondary}
              accessibilityLabel="Message"
              multiline
              style={styles.input}
            />
            <IconButton
              icon="send"
              accessibilityLabel="Send"
              color={draft.trim() ? colors.orchid : colors.secondary}
              onPress={send}
            />
          </View>
        ) : conversation ? (
          <View style={styles.closed}>
            <Text variant="bodySmall" color={colors.secondary}>
              This chat is closed. You can still read it.
            </Text>
          </View>
        ) : null}
      </KeyboardAvoidingView>
      <ChatMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        name={name}
        open={open}
        muted={chat.muted}
        onMute={muted =>
          setMuted(connectionId, muted).then(() =>
            client.invalidateQueries({
              queryKey: ['chat-state', connectionId],
            }),
          )
        }
        onBlock={() =>
          conversation && blockMember(conversation.otherId).then(refresh)
        }
        onCloseChat={() => closeConnection(connectionId).then(refresh)}
        onSafety={() => navigation.navigate('SafetyCentre')}
      />
    </SafeAreaView>
  );
}

function SafetyNote() {
  return (
    <View style={styles.note}>
      <Icon name="shieldCheck" size={sizes.icon.inline} color={colors.orchid} />
      <Text variant="bodySmall" color={colors.orchidDark} style={styles.fill}>
        Meet in public places and tell a friend. You can block or close this
        chat from the menu.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  fill: { flex: 1 },
  header: {
    minHeight: sizes.topBar,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    gap: spacing.xs,
  },
  who: { flex: 1 },
  messages: {
    paddingHorizontal: layout.pageMargin,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderRadius: radius.r20,
    backgroundColor: colors.selected,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xxs,
    paddingVertical: sizes.chat.composerPaddingY,
    paddingHorizontal: sizes.chat.composerPaddingX,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  input: {
    ...textStyles.body,
    flex: 1,
    color: colors.ink,
    minHeight: sizes.chat.composerInput,
    maxHeight: sizes.chat.composerInput * 3,
    paddingHorizontal: layout.pageMargin,
    paddingVertical: spacing.sm,
    borderRadius: sizes.chat.composerInput / 2,
    borderWidth: 1,
    borderColor: colors.field,
  },
  closed: {
    padding: sizes.chat.composerPaddingY,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
