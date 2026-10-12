import React from 'react';
import { Button, Screen, Text, TopBar } from '../components';
import { signOut } from '../features/auth/api';
import { colors } from '../theme';

export function PlaceholderScreen({
  title,
  canSignOut = false,
}: {
  title: string;
  canSignOut?: boolean;
}) {
  return (
    <Screen header={<TopBar title={title} />}>
      <Text color={colors.secondary}>Coming soon.</Text>
      {canSignOut ? (
        <Button
          label="Sign out"
          variant="secondary"
          onPress={() => signOut()}
        />
      ) : null}
    </Screen>
  );
}
