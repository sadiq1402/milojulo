import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { BottomSheet, Button, FlowScreen, Input, Text } from '../../components';
import { useRefreshAccountStage } from '../../features/account/useAccountStage';
import {
  checkInvite,
  invalidInviteMessage,
  redeemInvite,
} from '../../features/invite/api';
import {
  clearPendingInvite,
  loadPendingInvite,
  savePendingInvite,
} from '../../features/invite/pendingCode';
import type { SignedOutParams } from '../../navigation/types';
import { LoadingScreen } from '../StatusScreen';

const intro =
  'MiloJulo is invite-only during the Pune beta. Codes come from our events and from members.';

function InviteCodeForm({
  onSubmit,
  pending,
  error,
  onBack,
}: {
  onSubmit: (code: string) => void;
  pending: boolean;
  error?: string;
  onBack?: () => void;
}) {
  const [code, setCode] = useState('');
  const [explaining, setExplaining] = useState(false);
  return (
    <FlowScreen
      title="Enter your invite code"
      intro={intro}
      onBack={onBack}
      footer={
        <>
          <Button
            label="Continue"
            onPress={() => onSubmit(code.trim())}
            loading={pending}
            disabled={!code.trim()}
          />
          <Button
            label="I don't have a code"
            variant="text"
            onPress={() => setExplaining(true)}
          />
        </>
      }
    >
      <Input
        label="Invite code"
        placeholder="Your code"
        value={code}
        onChangeText={setCode}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        error={error}
      />
      <BottomSheet visible={explaining} onClose={() => setExplaining(false)}>
        <Text variant="h2">No code yet?</Text>
        <Text>
          MiloJulo is invite-only while we test in Pune. Codes come from our
          events and from people already on MiloJulo, so ask a friend who's on
          it or come along to one of our events.
        </Text>
        <Button label="OK" onPress={() => setExplaining(false)} />
      </BottomSheet>
    </FlowScreen>
  );
}

// Before sign-in: the code is checked and kept on the phone until it can be redeemed.
export function CheckInviteScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<SignedOutParams>>();
  const [error, setError] = useState<string>();
  const check = useMutation({
    mutationFn: async (code: string) => {
      if (!(await checkInvite(code))) {
        throw new Error(invalidInviteMessage);
      }
      await savePendingInvite(code);
    },
    onMutate: () => setError(undefined),
    onSuccess: () => navigation.navigate('Email'),
    onError: e => setError(e.message),
  });
  return (
    <InviteCodeForm
      onSubmit={code => check.mutate(code)}
      pending={check.isPending}
      error={error}
      onBack={navigation.goBack}
    />
  );
}

// Signed in without a profile: redeem the kept code at once, or ask for one.
export function RedeemInviteScreen() {
  const refreshStage = useRefreshAccountStage();
  const [error, setError] = useState<string>();
  const [checkingKept, setCheckingKept] = useState(true);
  const redeem = useMutation({
    mutationFn: async (code: string) => {
      await redeemInvite(code);
      await clearPendingInvite();
    },
    onMutate: () => setError(undefined),
    onSuccess: () => refreshStage(),
    onError: e => setError(e.message),
  });
  const { mutate } = redeem;

  useEffect(() => {
    loadPendingInvite().then(kept => {
      if (kept) {
        mutate(kept, { onSettled: () => setCheckingKept(false) });
      } else {
        setCheckingKept(false);
      }
    });
  }, [mutate]);

  if (checkingKept) {
    return <LoadingScreen />;
  }
  return (
    <InviteCodeForm
      onSubmit={code => redeem.mutate(code)}
      pending={redeem.isPending}
      error={error}
    />
  );
}
