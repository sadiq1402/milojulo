import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Avatar,
  BottomSheet,
  Button,
  Chip,
  Tag,
  Text,
  TextArea,
} from '../../components';
import { chatKeys } from '../../features/chat/queries';
import { modeLabels, type Mode } from '../../features/modes';
import { noteMaxLength, sendRequest } from '../../features/requests/api';
import { colors, fontFamily, fonts, layout, sizes, spacing } from '../../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  // modes are all the Modes I may request under; sharedModes the ones we both chose.
  member: { id: string; name: string; modes: Mode[]; sharedModes: Mode[] };
  onSent?: () => void;
};

export function SendRequestSheet({ visible, onClose, member, onSent }: Props) {
  // Every closing bumps the round, so the next opening starts with a fresh form.
  const [round, setRound] = useState(0);
  const close = () => {
    setRound(r => r + 1);
    onClose();
  };
  return (
    <BottomSheet visible={visible} onClose={close}>
      <SendRequestForm
        key={`${member.id}:${round}`}
        member={member}
        onClose={close}
        onSent={onSent}
      />
    </BottomSheet>
  );
}

function SendRequestForm({ member, onClose, onSent }: Omit<Props, 'visible'>) {
  const client = useQueryClient();
  const isShared = (m: Mode) => member.sharedModes.includes(m);
  const choices = [
    ...member.modes.filter(isShared),
    ...member.modes.filter(m => !isShared(m)),
  ];
  const [mode, setMode] = useState<Mode | undefined>(choices[0]);
  const [note, setNote] = useState('');
  // A Mode they haven't both chosen is allowed, but it asks first (#200).
  const [confirming, setConfirming] = useState<Mode>();
  const send = useMutation({
    mutationFn: (chosen: Mode) => sendRequest(member.id, chosen, note),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: chatKeys.conversations });
      onSent?.();
      onClose();
    },
  });

  // Scrolls when the keyboard leaves the sheet too little room (small phones, large text).
  return (
    <ScrollView
      style={styles.form}
      contentContainerStyle={styles.formContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Avatar name={member.name} size="sheet" />
        <Text variant="h2" accessibilityRole="header">
          Say hi to {member.name}
        </Text>
      </View>
      {choices.length > 0 ? (
        <View style={styles.field}>
          <Text variant="bodySmall" style={styles.label}>
            Connect as
          </Text>
          <View style={styles.chips}>
            {choices.map(m => (
              <Chip
                key={m}
                label={modeLabels[m]}
                selected={m === mode}
                onPress={() => setMode(m)}
                badge={
                  <>
                    {isShared(m) ? (
                      <Tag
                        label="Shared"
                        tone={m === mode ? 'onPhoto' : 'match'}
                      />
                    ) : null}
                    {m === 'casual' ? (
                      <Tag label="18+ · adults only" tone="warn" />
                    ) : null}
                  </>
                }
              />
            ))}
          </View>
          <Text variant="bodySmall" color={colors.secondary}>
            {member.sharedModes.length > 0
              ? `${member.name}'s Modes. Shared ones come first.`
              : `You don't share a Mode with ${member.name}. Pick one of ${member.name}'s.`}
          </Text>
        </View>
      ) : (
        <Text color={colors.secondary}>
          No Mode is open between you two right now.
        </Text>
      )}
      <View style={styles.field}>
        <TextArea
          label="Add a short note (optional)"
          placeholder="Mention something you have in common"
          value={note}
          onChangeText={setNote}
          maxLength={noteMaxLength}
        />
        <View style={styles.hint}>
          <Text
            variant="bodySmall"
            color={colors.secondary}
            style={styles.grow}
          >
            A note about a shared interest works best. Chat opens once{' '}
            {member.name} accepts.
          </Text>
          <Text variant="caption" color={colors.secondary}>
            {note.length}/{noteMaxLength}
          </Text>
        </View>
      </View>
      {send.error ? (
        <Text
          variant="bodySmall"
          color={colors.danger}
          accessibilityLiveRegion="polite"
        >
          {send.error.message}
        </Text>
      ) : null}
      {confirming ? (
        <View style={styles.field} testID="confirm-unshared-mode">
          <Text variant="bodySmall" color={colors.secondary}>
            You and {member.name} haven't both chosen {modeLabels[confirming]}.
            Connect anyway?
          </Text>
          <Button
            label="Connect anyway"
            loading={send.isPending}
            onPress={() => send.mutate(confirming)}
          />
          <Button
            label="Pick another Mode"
            variant="text"
            onPress={() => setConfirming(undefined)}
          />
        </View>
      ) : (
        <View>
          <Button
            label="Send request"
            disabled={!mode}
            loading={send.isPending}
            onPress={() =>
              mode && (isShared(mode) ? send.mutate(mode) : setConfirming(mode))
            }
          />
          <Button label="Cancel" variant="text" onPress={onClose} />
        </View>
      )}
      <Text variant="bodySmall" color={colors.secondary} style={styles.center}>
        You can send up to 10 requests in any 24 hours.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Edge to edge inside the sheet, so the button's shadow isn't clipped at the padding.
  form: { flexGrow: 0, marginHorizontal: -sizes.sheet.paddingX },
  formContent: {
    gap: layout.blockGap,
    paddingHorizontal: sizes.sheet.paddingX,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  field: { gap: spacing.xs },
  label: { fontFamily: fontFamily(fonts.text, '600') },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.chip.gap },
  hint: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
  center: { textAlign: 'center' },
});
