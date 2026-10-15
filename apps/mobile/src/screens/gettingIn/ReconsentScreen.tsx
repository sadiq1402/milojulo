import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMutation, useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Checkbox, FlowScreen, Text } from '../../components';
import { useRefreshAccountStage } from '../../features/account/useAccountStage';
import { useSession } from '../../features/auth/SessionProvider';
import {
  acceptConsents,
  fetchConsentDocuments,
} from '../../features/consents/api';
import { useProfileDraft } from '../../features/profileSetup/queries';
import type { ReconsentParams } from '../../navigation/types';
import { colors, fontFamily, fonts } from '../../theme';
import { LoadErrorScreen, LoadingScreen } from '../StatusScreen';
import {
  AgeConsentScreen,
  collected,
  DocLink,
  placeholderUrls,
} from './AgeConsentScreen';

// After withdrawing a consent: accept the current documents again, keeping the date of birth
// already given, or delete the account.
export function ReconsentScreen() {
  const userId = useSession().session!.user.id;
  const draft = useProfileDraft(userId);
  if (draft.isError) {
    return <LoadErrorScreen onRetry={() => draft.refetch()} />;
  }
  if (!draft.data) {
    return <LoadingScreen />;
  }
  // No date on file (should not happen): the full step asks for it.
  if (!draft.data.birthDate) {
    return <AgeConsentScreen />;
  }
  return <AcceptAgain birthDate={draft.data.birthDate} />;
}

function AcceptAgain({ birthDate }: { birthDate: string }) {
  const navigation =
    useNavigation<NativeStackNavigationProp<ReconsentParams>>();
  const refreshStage = useRefreshAccountStage();
  const documents = useQuery({
    queryKey: ['consent-documents'],
    queryFn: fetchConsentDocuments,
  });
  const [dataConsent, setDataConsent] = useState(false);
  const [termsConsent, setTermsConsent] = useState(false);
  const accept = useMutation({
    mutationFn: () => acceptConsents(birthDate, documents.data!),
    onSuccess: () => refreshStage(),
  });
  const error =
    accept.error?.message ??
    (documents.isError ? "We couldn't reach MiloJulo. Try again." : undefined);

  return (
    <FlowScreen
      title="Accept to carry on"
      intro="You withdrew a consent, so your profile is hidden from everyone. Accept the current Terms, Community Guidelines and data notice to show it again, or delete your account."
      footer={
        <>
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
            label="Continue"
            onPress={() => accept.mutate()}
            loading={accept.isPending}
            disabled={!dataConsent || !termsConsent || !documents.data}
          />
          <Button
            label="Delete my account instead"
            variant="text"
            onPress={() =>
              navigation.navigate('DeleteAccount', { offerPause: false })
            }
          />
        </>
      }
    >
      <Card>
        <Text variant="bodySmall" style={styles.label}>
          What we collect and why
        </Text>
        {collected.map(([what, why]) => (
          <Text key={what} variant="bodySmall" color={colors.tagNeutralInk}>
            {'•  '}
            <Text
              variant="bodySmall"
              color={colors.tagNeutralInk}
              style={styles.label}
            >
              {what}
            </Text>{' '}
            {why}
          </Text>
        ))}
      </Card>
      <View>
        <Checkbox
          checked={dataConsent}
          onChange={setDataConsent}
          accessibilityLabel="I agree to this use of my data"
        >
          I agree to this use of my data. I can withdraw consent or delete my
          account any time in Settings.
        </Checkbox>
        <Checkbox
          checked={termsConsent}
          onChange={setTermsConsent}
          accessibilityLabel="I accept the Terms and the Community Guidelines"
        >
          I accept the{' '}
          <DocLink
            label="Terms"
            doc={documents.data?.terms}
            fallback={placeholderUrls.terms}
          />{' '}
          and the{' '}
          <DocLink
            label="Community Guidelines"
            doc={documents.data?.guidelines}
            fallback={placeholderUrls.guidelines}
          />
          .
        </Checkbox>
      </View>
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: fontFamily(fonts.text, '600') },
});
