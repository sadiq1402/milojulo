import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Avatar,
  BottomSheet,
  Button,
  Icon,
  IconButton,
  Tag,
  Text,
} from '../../components';
import { useSession } from '../../features/auth/SessionProvider';
import { useAreaNames } from '../../features/catalog/queries';
import {
  blockMember,
  closeConnection,
  setMuted,
} from '../../features/chat/api';
import {
  pickMedia,
  startVoiceNote,
  type MediaSource,
  type VoiceRecording,
} from '../../features/chat/capture';
import { setMediaConsent } from '../../features/chat/media';
import {
  chatKeys,
  useConversations,
  useMediaState,
  useMediaUrls,
} from '../../features/chat/queries';
import { useChat, type ChatItem } from '../../features/chat/useChat';
import { useModeChange } from '../../features/chat/useModeChange';
import { modeLabels } from '../../features/modes';
import { useSecureScreen } from '../../lib/secureScreen';
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
import { formatDuration } from './MediaContent';
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

  // Android blocks screenshots and screen recording here; iOS can't (docs/09).
  useSecureScreen();

  const mediaUrls = useMediaUrls(chat.items.filter(m => m.delivery === 'sent'));
  const mediaState = useMediaState(connectionId, conversation?.mode, accepted);
  const consent = useMutation({
    mutationFn: (on: boolean) => setMediaConsent(connectionId, on),
    onSettled: () =>
      client.invalidateQueries({ queryKey: chatKeys.mediaState(connectionId) }),
  });
  const casual = mediaState.data?.isCasual ?? false;
  // Media Consent: in Casual, photos and video wait for both switches.
  const visualsOff =
    casual && !(mediaState.data?.mine && mediaState.data?.theirs);
  const consentNote = !casual
    ? null
    : !mediaState.data?.mine
    ? 'Photos and video are off in this chat. Switch on photos and video in the menu; they work once you both have.'
    : !mediaState.data?.theirs
    ? `Waiting for ${name} to allow photos and video too.`
    : null;

  const [attachOpen, setAttachOpen] = useState(false);
  const [mediaError, setMediaError] = useState<string>();
  const attach = async (source: MediaSource) => {
    setAttachOpen(false);
    setMediaError(undefined);
    try {
      const picked = await pickMedia(source);
      if (picked) {
        chat.sendMedia(picked);
      }
    } catch (e) {
      setMediaError((e as Error).message);
    }
  };

  // Hold to record; letting go (or reaching 2 minutes) sends.
  const [recordingMs, setRecordingMs] = useState<number | null>(null);
  const recording = useRef<Promise<VoiceRecording | null>>(null);
  const stopRecording = async () => {
    const started = recording.current;
    recording.current = null;
    setRecordingMs(null);
    const note = await (await started)?.stop().catch(() => null);
    if (note) {
      chat.sendMedia(note);
    }
  };
  const startRecording = () => {
    setMediaError(undefined);
    setRecordingMs(0);
    recording.current = startVoiceNote({
      onTick: setRecordingMs,
      onLimit: () => {
        stopRecording();
      },
    }).catch((e: Error) => {
      setMediaError(e.message);
      setRecordingMs(null);
      return null;
    });
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
              mediaUrl={mediaUrls.data?.[item.id]}
              mediaUrlsLoading={mediaUrls.isPending}
              mediaOff={visualsOff}
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
        {mediaError ? (
          <Text
            variant="bodySmall"
            color={colors.danger}
            style={styles.actionError}
            accessibilityLiveRegion="polite"
          >
            {mediaError}
          </Text>
        ) : null}
        {accepted && consentNote ? (
          <Text
            variant="bodySmall"
            color={colors.secondary}
            style={styles.actionError}
          >
            {consentNote}
          </Text>
        ) : null}
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
            <IconButton
              icon="image"
              accessibilityLabel="Attach photo or video"
              disabled={visualsOff}
              onPress={() => setAttachOpen(true)}
            />
            {recordingMs !== null ? (
              <View style={styles.recording} accessibilityLiveRegion="polite">
                <Text color={colors.danger}>
                  Recording {formatDuration(recordingMs)} of 2:00, release to
                  send
                </Text>
              </View>
            ) : (
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Message"
                placeholderTextColor={colors.secondary}
                accessibilityLabel="Message"
                multiline
                style={styles.input}
              />
            )}
            {draft.trim() ? (
              <IconButton
                icon="send"
                accessibilityLabel="Send"
                color={colors.orchid}
                onPress={send}
              />
            ) : (
              <Pressable
                onPressIn={startRecording}
                onPressOut={stopRecording}
                accessibilityRole="button"
                accessibilityLabel="Hold to record a voice note"
                style={[
                  styles.mic,
                  recordingMs !== null && styles.micRecording,
                ]}
              >
                <Icon
                  name="mic"
                  color={recordingMs !== null ? colors.white : colors.ink}
                />
              </Pressable>
            )}
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
        mediaConsent={casual ? mediaState.data?.mine ?? false : undefined}
        onMediaConsent={on => consent.mutate(on)}
      />
      <BottomSheet visible={attachOpen} onClose={() => setAttachOpen(false)}>
        <View style={styles.sheet}>
          <Button
            label="Choose from gallery"
            variant="secondary"
            onPress={() => attach('library')}
          />
          <Button
            label="Take a photo"
            variant="secondary"
            onPress={() => attach('camera-photo')}
          />
          <Button
            label="Record a video"
            variant="secondary"
            onPress={() => attach('camera-video')}
          />
          <Text variant="caption" color={colors.secondary}>
            Videos up to 30 seconds. Photos, videos and voice notes are deleted
            after 90 days.
          </Text>
          <Button
            label="Cancel"
            variant="text"
            onPress={() => setAttachOpen(false)}
          />
        </View>
      </BottomSheet>
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
  recording: {
    flex: 1,
    minHeight: sizes.chat.composerInput,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  mic: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micRecording: { backgroundColor: colors.orchid },
  sheet: { gap: spacing.xs },
  closed: {
    padding: sizes.chat.composerPaddingY,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
});
