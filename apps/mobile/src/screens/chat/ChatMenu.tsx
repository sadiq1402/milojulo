import React, { useState } from 'react';
import { View } from 'react-native';
import { BottomSheet, Button, Text } from '../../components';
import { colors, spacing } from '../../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  name: string;
  // The Connection is accepted, so it can still be closed.
  accepted: boolean;
  muted: boolean;
  onMute: (muted: boolean) => void;
  onBlock: () => void;
  onCloseChat: () => void;
  onSafety: () => void;
};

// Report joins this menu with the Reports ticket (#49).
export function ChatMenu({
  visible,
  onClose,
  name,
  accepted,
  muted,
  onMute,
  onBlock,
  onCloseChat,
  onSafety,
}: Props) {
  const [confirming, setConfirming] = useState<'block' | 'close'>();
  const dismiss = () => {
    setConfirming(undefined);
    onClose();
  };
  const confirmAnd = (action: () => void) => () => {
    action();
    dismiss();
  };

  return (
    <BottomSheet visible={visible} onClose={dismiss}>
      {confirming === 'block' ? (
        <View style={{ gap: spacing.xs }} testID="confirm-block">
          <Text variant="h2">Block {name}?</Text>
          <Text color={colors.secondary}>
            They won't be able to message you or see you in Discover, and this
            chat closes. They aren't told.
          </Text>
          <Button
            label="Block"
            variant="danger"
            onPress={confirmAnd(onBlock)}
          />
          <Button
            label="Cancel"
            variant="text"
            onPress={() => setConfirming(undefined)}
          />
        </View>
      ) : confirming === 'close' ? (
        <View style={{ gap: spacing.xs }} testID="confirm-close">
          <Text variant="h2">Close this chat?</Text>
          <Text color={colors.secondary}>
            You both keep what's been said, but nobody can send new messages.
            Either of you can send a new Connection Request later.
          </Text>
          <Button
            label="Close chat"
            variant="danger"
            onPress={confirmAnd(onCloseChat)}
          />
          <Button
            label="Cancel"
            variant="text"
            onPress={() => setConfirming(undefined)}
          />
        </View>
      ) : (
        <View style={{ gap: spacing.xs }}>
          <Button
            label={muted ? 'Unmute notifications' : 'Mute notifications'}
            variant="secondary"
            onPress={confirmAnd(() => onMute(!muted))}
          />
          {accepted ? (
            <Button
              label="Close chat"
              variant="secondary"
              onPress={() => setConfirming('close')}
            />
          ) : null}
          <Button
            label={`Block ${name}`}
            variant="secondary"
            onPress={() => setConfirming('block')}
          />
          <Button
            label="Safety Centre"
            variant="text"
            onPress={confirmAnd(onSafety)}
          />
        </View>
      )}
    </BottomSheet>
  );
}
