import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet, Button, Text } from '../../components';
import { modeLabels, type Mode } from '../../features/modes';
import { colors, spacing } from '../../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  name: string;
  // The Connection is accepted, so its Mode can change and it can still be closed.
  accepted: boolean;
  muted: boolean;
  // Eligible Modes other than the current one; undefined while loading.
  modeOptions?: Mode[];
  // Whether the Change Mode view is open, so the screen loads the options only then.
  onChoosingModes: (choosing: boolean) => void;
  onPropose: (mode: Mode) => Promise<void>;
  onMute: (muted: boolean) => void;
  onBlock: () => void;
  onCloseChat: () => void;
  onSafety: () => void;
};

export function ChatMenu({
  visible,
  onClose,
  name,
  accepted,
  muted,
  modeOptions,
  onChoosingModes,
  onPropose,
  onMute,
  onBlock,
  onCloseChat,
  onSafety,
}: Props) {
  const [view, setViewState] = useState<'menu' | 'modes' | 'block' | 'close'>(
    'menu',
  );
  const setView = (next: typeof view) => {
    setViewState(next);
    onChoosingModes(next === 'modes');
  };
  const [proposeError, setProposeError] = useState<string>();
  const dismiss = () => {
    setView('menu');
    setProposeError(undefined);
    onClose();
  };
  const andClose = (action: () => void) => () => {
    action();
    dismiss();
  };
  const propose = (mode: Mode) =>
    onPropose(mode).then(dismiss, (e: Error) => setProposeError(e.message));
  const cancel = (
    <Button label="Cancel" variant="text" onPress={() => setView('menu')} />
  );

  return (
    <BottomSheet visible={visible} onClose={dismiss}>
      {view === 'modes' ? (
        <View style={styles.stack}>
          <Text variant="h2">Change Mode</Text>
          <Text color={colors.secondary}>
            {name} gets to accept or decline. Until then the chat stays as it
            is.
          </Text>
          {modeOptions?.length === 0 ? (
            <Text color={colors.secondary}>
              No other Mode is open between you right now.
            </Text>
          ) : null}
          {modeOptions?.map(mode => (
            <Button
              key={mode}
              label={modeLabels[mode]}
              variant="secondary"
              onPress={() => propose(mode)}
            />
          ))}
          {proposeError ? (
            <Text
              variant="bodySmall"
              color={colors.danger}
              accessibilityLiveRegion="polite"
            >
              {proposeError}
            </Text>
          ) : null}
          {cancel}
        </View>
      ) : view === 'block' ? (
        <View style={styles.stack} testID="confirm-block">
          <Text variant="h2">Block {name}?</Text>
          <Text color={colors.secondary}>
            They won't be able to message you or see you in Discover, and this
            chat closes. They aren't told.
          </Text>
          <Button label="Block" variant="danger" onPress={andClose(onBlock)} />
          {cancel}
        </View>
      ) : view === 'close' ? (
        <View style={styles.stack} testID="confirm-close">
          <Text variant="h2">Close this chat?</Text>
          <Text color={colors.secondary}>
            You both keep what's been said, but nobody can send new messages.
            Either of you can send a new Connection Request later.
          </Text>
          <Button
            label="Close chat"
            variant="danger"
            onPress={andClose(onCloseChat)}
          />
          {cancel}
        </View>
      ) : (
        <View style={styles.stack}>
          {accepted ? (
            <Button
              label="Change Mode"
              variant="secondary"
              onPress={() => setView('modes')}
            />
          ) : null}
          <Button
            label={muted ? 'Unmute notifications' : 'Mute notifications'}
            variant="secondary"
            onPress={andClose(() => onMute(!muted))}
          />
          {accepted ? (
            <Button
              label="Close chat"
              variant="secondary"
              onPress={() => setView('close')}
            />
          ) : null}
          <Button
            label={`Block ${name}`}
            variant="secondary"
            onPress={() => setView('block')}
          />
          <Button
            label="Safety Centre"
            variant="text"
            onPress={andClose(onSafety)}
          />
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.xs },
});
