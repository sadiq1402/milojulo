import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
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
import {
  colors,
  fontFamily,
  fonts,
  modeTints,
  sizes,
  spacing,
} from '../../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  // modes are the pair's Eligible Modes.
  member: { id: string; name: string; modes: Mode[] };
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
  const only = member.modes.length === 1 ? member.modes[0] : undefined;
  const [mode, setMode] = useState<Mode | undefined>(only);
  const [note, setNote] = useState('');
  const send = useMutation({
    mutationFn: (chosen: Mode) => sendRequest(member.id, chosen, note),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: chatKeys.conversations });
      onSent?.();
      onClose();
    },
  });

  return (
    <>
      <View style={styles.header}>
        <Avatar name={member.name} size="sheet" />
        <Text variant="h2" accessibilityRole="header">
          Say hi to {member.name}
        </Text>
      </View>
      {member.modes.length > 1 ? (
        <View style={styles.field}>
          <Text variant="bodySmall" style={styles.label}>
            Connect as
          </Text>
          <View style={styles.chips}>
            {member.modes.map(m => (
              <Chip
                key={m}
                label={modeLabels[m]}
                tint={modeTints[m]}
                selected={m === mode}
                onPress={() => setMode(m)}
              />
            ))}
          </View>
        </View>
      ) : only ? (
        <View style={styles.chips}>
          <Tag label={modeLabels[only]} tone={only} />
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
      <View>
        <Button
          label="Send request"
          disabled={!mode}
          loading={send.isPending}
          onPress={() => mode && send.mutate(mode)}
        />
        <Button label="Cancel" variant="text" onPress={onClose} />
      </View>
      <Text variant="bodySmall" color={colors.secondary} style={styles.center}>
        You can send up to 10 requests in any 24 hours.
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  field: { gap: spacing.xs },
  label: { fontFamily: fontFamily(fonts.text, '600') },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: sizes.chip.gap },
  hint: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
  center: { textAlign: 'center' },
});
