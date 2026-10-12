import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, FlowScreen, Icon, Input, Text } from '../../components';
import { sendCode } from '../../features/auth/api';
import type { SignedOutParams } from '../../navigation/types';
import { colors, layout, radius, sizes, spacing } from '../../theme';

export function EmailScreen({
  navigation,
}: NativeStackScreenProps<SignedOutParams, 'Email'>) {
  const [email, setEmail] = useState('');
  const send = useMutation({
    mutationFn: (address: string) => sendCode(address),
    onSuccess: (_data, address) =>
      navigation.navigate('Otp', { email: address }),
  });
  return (
    <FlowScreen
      title="What's your email?"
      intro="We'll send a 6-digit code to sign you in. No password to remember."
      onBack={navigation.goBack}
      footer={
        <Button
          label="Send code"
          onPress={() => send.mutate(email.trim())}
          loading={send.isPending}
          disabled={!email.trim()}
        />
      }
    >
      <Input
        label="Email address"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        error={send.error?.message}
      />
      <View style={styles.note}>
        <Icon
          name="shieldCheck"
          size={sizes.icon.inline}
          color={colors.orchid}
        />
        <Text
          variant="bodySmall"
          color={colors.orchidDark}
          style={styles.noteText}
        >
          A verified email only confirms your inbox, not who someone is. Meet in
          public the first few times, and report anything that feels off.
        </Text>
      </View>
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: layout.cardPadding,
    borderRadius: radius.r24,
    backgroundColor: colors.selected,
  },
  noteText: { flex: 1 },
});
