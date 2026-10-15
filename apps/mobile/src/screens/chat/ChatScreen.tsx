import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Avatar, Icon, IconButton, Tag, Text } from '../../components';
import { useSession } from '../../features/auth/SessionProvider';
import { useAreaNames } from '../../features/catalog/queries';
import {
  blockMember,
  closeConnection,
  setMuted,
} from '../../features/chat/api';
import { chatKeys, useConversations } from '../../features/chat/queries';
import { useChat, type ChatItem } from '../../features/chat/useChat';
import { useModeChange } from '../../features/chat/useModeChange';
import { modeLabels } from '../../features/modes';
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
import { ModeChangeCard } from './ModeChangeCard';

export function ChatScreen({
  navigation,
  route,
}: NativeStackScreenProps<MemberParams, 'Chat'>) {
  const { connectionId } = route.params;
  const myId = useSession().session!.user.id;
  const client = useQueryClient();
  const conversations = useConversations();
  const areas = useAreaNames();
  const chat = useChat(connectionId, myId, useIsFocused());
  const [draft, setDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const conversation = conversations.data?.find(
    c => c.connectionId === connectionId,
  );
  const name = conversation?.otherName ?? '';
  const accepted = conversation?.status === 'accepted';
  const [choosingMode, setChoosingMode] = useState(false);
  const modeChange = useModeChange(
    connectionId,
    conversation?.otherId,
    choosingMode,
  );
  const menuAction = useMutation({
    mutationFn: (action: () => Promise<void>) => action(),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: chatKeys.conversations });
      client.invalidateQueries({ queryKey: chatKeys.state(connectionId) });
    },
  });

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
          <View style={styles.subline}>
            {conversation?.otherAreaId ? (
              <Text variant="caption" color={colors.secondary}>
                {areas.data?.[conversation.otherAreaId] ?? ''}
              </Text>
            ) : null}
            {conversation ? (
              <Tag
                label={modeLabels[conversation.mode]}
                tone={conversation.mode}
              />
            ) : null}
          </View>
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
        {/* Inverted so the newest message stays in view above the composer and keyboard. */}
        <FlatList
          inverted
          data={[...chat.items].reverse()}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messages}
          ListFooterComponent={<SafetyNote />}
          renderItem={({ item }: { item: ChatItem }) => (
            <MessageBubble
              item={item}
              mine={item.senderId === myId}
              seen={item.id === chat.seenId}
              onRetry={() => chat.retry(item.id)}
              onReport={
                item.senderId !== myId && conversation
                  ? () =>
                      navigation.navigate('Report', {
                        targetType: 'message',
                        targetId: item.id,
                        memberId: conversation.otherId,
                        memberName: name,
                      })
                  : undefined
              }
            />
          )}
        />
        {menuAction.isError ? (
          <Text
            variant="bodySmall"
            color={colors.danger}
            style={styles.actionError}
            accessibilityLiveRegion="polite"
          >
            That didn't work. Check your connection and try again.
          </Text>
        ) : null}
        {accepted && modeChange.open ? (
          <ModeChangeCard
            change={modeChange.open}
            mine={modeChange.open.proposedBy === myId}
            name={name}
            pending={modeChange.respond.isPending}
            error={modeChange.respond.error?.message}
            onRespond={accept =>
              modeChange.respond.mutate({ id: modeChange.open!.id, accept })
            }
          />
        ) : null}
        {accepted ? (
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
        accepted={accepted}
        muted={chat.muted}
        modeOptions={modeChange.eligibleModes?.filter(
          mode => mode !== conversation?.mode,
        )}
        onChoosingModes={setChoosingMode}
        onPropose={mode => modeChange.propose.mutateAsync(mode)}
        onMute={muted => menuAction.mutate(() => setMuted(connectionId, muted))}
        onBlock={() =>
          conversation &&
          menuAction.mutate(() => blockMember(conversation.otherId))
        }
        onCloseChat={() =>
          menuAction.mutate(() => closeConnection(connectionId))
        }
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
  subline: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  actionError: {
    paddingHorizontal: layout.pageMargin,
    paddingBottom: spacing.xs,
  },
  messages: {
    paddingHorizontal: layout.pageMargin,
    // Inverted: this is the gap above the composer.
    paddingTop: spacing.md,
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
