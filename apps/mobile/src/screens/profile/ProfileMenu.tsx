import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet, Button, Text } from '../../components';
import { colors, spacing } from '../../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  name: string;
  onBlock: () => Promise<void>;
};

// Report joins this menu with the Reports ticket (#49).
export function ProfileMenu({ visible, onClose, name, onBlock }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [error, setError] = useState<string>();
  const dismiss = () => {
    setConfirming(false);
    setError(undefined);
    onClose();
  };
  const block = () => {
    setBlocking(true);
    setError(undefined);
    onBlock().catch((e: Error) => {
      setBlocking(false);
      setError(e.message);
    });
  };

  return (
    <BottomSheet visible={visible} onClose={dismiss}>
      {confirming ? (
        <View style={styles.stack} testID="confirm-block">
          <Text variant="h2">Block {name}?</Text>
          <Text color={colors.secondary}>
            You won't see each other in Discover again, they can't message you,
            and any Connection between you closes. They aren't told.
          </Text>
          <Button
            label="Block"
            variant="danger"
            loading={blocking}
            onPress={block}
          />
          {error ? (
            <Text
              variant="bodySmall"
              color={colors.danger}
              accessibilityLiveRegion="polite"
            >
              {error}
            </Text>
          ) : null}
          <Button
            label="Cancel"
            variant="text"
            onPress={() => setConfirming(false)}
          />
        </View>
      ) : (
        <View style={styles.stack}>
          <Button
            label={`Block ${name}`}
            variant="secondary"
            onPress={() => setConfirming(true)}
          />
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.xs },
});
