import { useMutation } from '@tanstack/react-query';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Input, Screen, Text } from '../components';
import { sendCode, verifyCode } from '../features/auth/api';
import { colors, layout, textStyles } from '../theme';

// Placeholder until the Getting in screens (#37): email, then the 6-digit code.
export function SignInScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const send = useMutation({
    mutationFn: () => sendCode(email.trim()),
    onSuccess: () => setCodeSent(true),
  });
  const verify = useMutation({
    mutationFn: () => verifyCode(email.trim(), code.trim()),
  });
  const error = (codeSent ? verify.error : send.error)?.message;

  return (
    <Screen>
      <View style={styles.hero}>
        <Text variant="display">
          <Text style={textStyles.display} color={colors.orchid}>
            Milo
          </Text>
          <Text style={textStyles.display} color={colors.violet}>
            Julo
          </Text>
        </Text>
        <Text color={colors.secondary}>Find your people.</Text>
      </View>
      {codeSent ? (
        <>
          <Input
            label="Code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={6}
            error={error}
          />
          <Button
            label="Sign in"
            onPress={() => verify.mutate()}
            loading={verify.isPending}
            disabled={code.trim().length !== 6}
          />
          <Button
            label="Use a different email"
            variant="text"
            onPress={() => setCodeSent(false)}
          />
        </>
      ) : (
        <>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={error}
          />
          <Button
            label="Send code"
            onPress={() => send.mutate()}
            loading={send.isPending}
            disabled={!email.trim()}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingTop: layout.sectionGap * 2,
    paddingBottom: layout.sectionGap,
    gap: layout.blockGap / 2,
  },
});
