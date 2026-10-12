import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { Button, Card, Screen, Text, TopBar } from '../components';
import { signOut } from '../features/auth/api';
import { useSession } from '../features/auth/SessionProvider';
import { fetchIsAdmin } from '../features/hello/api';
import { colors } from '../theme';

// Signed-in placeholder until the onboarding screens (#37, #38).
export function HelloScreen() {
  const { session } = useSession();
  const isAdmin = useQuery({
    queryKey: ['is-admin', session?.user.id],
    queryFn: fetchIsAdmin,
  });

  return (
    <Screen header={<TopBar title="Welcome" />}>
      <Text variant="h1">Hello</Text>
      <Card>
        <Text>Signed in as {session?.user.email}</Text>
        {isAdmin.isPending ? (
          <Text color={colors.secondary}>Checking your account…</Text>
        ) : null}
        {isAdmin.isError ? (
          <Text color={colors.danger}>
            We couldn't reach MiloJulo. Try again.
          </Text>
        ) : null}
        {isAdmin.isSuccess ? (
          <Text color={colors.secondary}>
            {isAdmin.data ? 'Admin account' : 'Member account'}
          </Text>
        ) : null}
      </Card>
      <Button label="Sign out" variant="secondary" onPress={() => signOut()} />
    </Screen>
  );
}
