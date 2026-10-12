import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { Button, CodeInput, FlowScreen, Text } from '../../components';
import { sendCode, verifyCode } from '../../features/auth/api';
import type { SignedOutParams } from '../../navigation/types';
import { colors } from '../../theme';

const resendAfter = 30;

export function OtpScreen({
  navigation,
  route,
}: NativeStackScreenProps<SignedOutParams, 'Otp'>) {
  const { email } = route.params;
  const [code, setCode] = useState('');
  const [resendAt, setResendAt] = useState(
    () => Date.now() + resendAfter * 1000,
  );
  const [now, setNow] = useState(() => Date.now());
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));

  // Counts against a deadline, so time spent in another app still counts.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // A successful verify signs in; the navigator then moves on by itself.
  const verify = useMutation({ mutationFn: () => verifyCode(email, code) });
  const resend = useMutation({
    mutationFn: () => sendCode(email),
    onSuccess: () => {
      setResendAt(Date.now() + resendAfter * 1000);
      setNow(Date.now());
    },
  });
  const error = (verify.error ?? resend.error)?.message;

  return (
    <FlowScreen
      title="Check your inbox"
      intro={`Enter the 6-digit code we sent to ${email}.`}
      onBack={navigation.goBack}
      footer={
        <Button
          label="Verify"
          onPress={() => verify.mutate()}
          loading={verify.isPending}
          disabled={code.length !== 6}
        />
      }
    >
      <CodeInput value={code} onChange={setCode} />
      {error ? (
        <Text
          variant="bodySmall"
          color={colors.danger}
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      ) : null}
      {wait > 0 ? (
        <Text variant="bodySmall" color={colors.secondary}>
          {`Didn't get it? Resend in 0:${String(wait).padStart(2, '0')}`}
        </Text>
      ) : (
        <Button
          label="Resend code"
          variant="text"
          compact
          onPress={() => resend.mutate()}
          loading={resend.isPending}
        />
      )}
    </FlowScreen>
  );
}
