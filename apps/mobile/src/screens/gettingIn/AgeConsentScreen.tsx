import { useMutation, useQuery } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Checkbox,
  FlowScreen,
  Input,
  Text,
} from '../../components';
import { useRefreshAccountStage } from '../../features/account/useAccountStage';
import {
  acceptConsents,
  fetchConsentDocuments,
  type ConsentDocument,
} from '../../features/consents/api';
import { toBirthDate } from '../../features/consents/birthDate';
import { colors, fontFamily, fonts, spacing } from '../../theme';

// Until the lawyer-reviewed documents have URLs.
const placeholderUrls = {
  terms: 'https://example.com/milojulo/terms',
  guidelines: 'https://example.com/milojulo/community-guidelines',
};

const collected = [
  ['Email', 'to sign you in'],
  ['Date of birth', 'to confirm you are 18 or older'],
  [
    'Photos and profile answers',
    'to show you to people looking for the same kind of connection',
  ],
  ['Area, never exact location', 'to suggest people nearby'],
  ['Messages and media', 'to deliver your chats'],
];

function DocLink({
  label,
  doc,
  fallback,
}: {
  label: string;
  doc?: ConsentDocument;
  fallback: string;
}) {
  return (
    <Text
      variant="bodySmall"
      color={colors.orchid}
      accessibilityRole="link"
      onPress={() => Linking.openURL(doc?.url ?? fallback)}
    >
      {label}
    </Text>
  );
}

export function AgeConsentScreen() {
  const refreshStage = useRefreshAccountStage();
  const documents = useQuery({
    queryKey: ['consent-documents'],
    queryFn: fetchConsentDocuments,
  });
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [dataConsent, setDataConsent] = useState(false);
  const [termsConsent, setTermsConsent] = useState(false);
  const [dateError, setDateError] = useState<string>();
  const accept = useMutation({
    mutationFn: (birthDate: string) =>
      acceptConsents(birthDate, documents.data!),
    onSuccess: () => refreshStage(),
  });

  const ready =
    day.trim() &&
    month.trim() &&
    year.trim().length === 4 &&
    dataConsent &&
    termsConsent;
  const submit = () => {
    const birthDate = toBirthDate(day, month, year);
    setDateError(birthDate ? undefined : 'Enter a real date of birth.');
    if (birthDate) {
      accept.mutate(birthDate);
    }
  };
  const error =
    dateError ??
    accept.error?.message ??
    (documents.isError ? "We couldn't reach MiloJulo. Try again." : undefined);

  return (
    <FlowScreen
      title="Before we start"
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
            onPress={submit}
            loading={accept.isPending}
            disabled={!ready || !documents.data}
          />
        </>
      }
    >
      <View style={styles.field}>
        <Text variant="bodySmall" style={styles.label}>
          Date of birth
        </Text>
        <View style={styles.dateRow}>
          <View style={styles.part}>
            <Input
              accessibilityLabel="Day"
              placeholder="DD"
              value={day}
              onChangeText={setDay}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
          <View style={styles.part}>
            <Input
              accessibilityLabel="Month"
              placeholder="MM"
              value={month}
              onChangeText={setMonth}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
          <View style={styles.yearPart}>
            <Input
              accessibilityLabel="Year"
              placeholder="YYYY"
              value={year}
              onChangeText={setYear}
              keyboardType="number-pad"
              maxLength={4}
            />
          </View>
        </View>
        <Text variant="bodySmall" color={colors.secondary}>
          You must be 18 or older to use MiloJulo.
        </Text>
      </View>
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
  field: { gap: 6 },
  label: { fontFamily: fontFamily(fonts.text, '600') },
  dateRow: { flexDirection: 'row', gap: spacing.xs },
  part: { flex: 1 },
  yearPart: { flex: 1.4 },
});
