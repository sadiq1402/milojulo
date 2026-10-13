import { useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { StyleSheet } from 'react-native';
import { Button, Card, Text } from '../../components';
import { unpause } from '../../features/discover/api';
import { discoverKeys } from '../../features/discover/queries';
import { colors, layout } from '../../theme';

// While Paused, nobody new sees the Member, and Discover and the Activity Board stay empty.
export function PausedNotice({
  explanation,
  alsoRefresh,
}: {
  explanation: string;
  alsoRefresh?: string[];
}) {
  const client = useQueryClient();
  const resume = useMutation({
    mutationFn: unpause,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: discoverKeys.all });
      if (alsoRefresh) {
        client.invalidateQueries({ queryKey: alsoRefresh });
      }
    },
  });
  return (
    <Card style={styles.card}>
      <Text variant="h2">Your profile is paused</Text>
      <Text color={colors.secondary}>{explanation}</Text>
      <Button
        label="Unpause"
        loading={resume.isPending}
        onPress={() => resume.mutate()}
      />
      {resume.isError ? (
        <Text
          variant="bodySmall"
          color={colors.danger}
          accessibilityLiveRegion="polite"
        >
          {resume.error.message}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: layout.blockGap },
});
