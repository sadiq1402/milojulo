import React from 'react';
import { colors } from '../theme';
import { Text } from './Text';

export function ErrorText({ text }: { text: string }) {
  return (
    <Text
      variant="bodySmall"
      color={colors.danger}
      accessibilityLiveRegion="polite"
    >
      {text}
    </Text>
  );
}
