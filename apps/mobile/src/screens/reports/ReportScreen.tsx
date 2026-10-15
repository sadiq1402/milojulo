import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Button,
  Checkbox,
  OptionCard,
  Text,
  TextArea,
  TopBar,
} from '../../components';
import { activityKeys } from '../../features/activities/queries';
import { blockMember } from '../../features/chat/api';
import { chatKeys } from '../../features/chat/queries';
import { discoverKeys } from '../../features/discover/queries';
import {
  detailsLimit,
  reportContent,
  reportReasons,
  type ReportReason,
  type ReportTarget,
} from '../../features/reports/api';
import type { MemberParams } from '../../navigation/types';
import { colors, layout, spacing } from '../../theme';

type Props = NativeStackScreenProps<MemberParams, 'Report'>;

function titleFor(targetType: ReportTarget, name: string) {
  switch (targetType) {
    case 'profile':
      return `Report ${name}`;
    case 'photo':
      return `Report ${name}'s photo`;
    case 'message':
      return 'Report this message';
    case 'activity':
      return 'Report this Activity';
  }
}

const reviewLine =
  'A person reviews every report. We aim to respond within 24 hours.';

export function ReportScreen({ navigation, route }: Props) {
  const { targetType, targetId, memberId, memberName } = route.params;
  const name = memberName ?? 'them';
  const client = useQueryClient();
  const [reason, setReason] = useState<ReportReason>();
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [missingReason, setMissingReason] = useState(false);

  // The report stands even if the block after it fails; the result says whether it blocked.
  const submit = useMutation({
    mutationFn: async (chosen: ReportReason) => {
      await reportContent({ targetType, targetId, reason: chosen, details });
      if (!alsoBlock) {
        return { blocked: false, blockFailed: false };
      }
      try {
        await blockMember(memberId);
        return { blocked: true, blockFailed: false };
      } catch {
        return { blocked: false, blockFailed: true };
      }
    },
    onSuccess: ({ blocked }) => {
      if (blocked) {
        client.invalidateQueries({ queryKey: discoverKeys.all });
        client.invalidateQueries({ queryKey: chatKeys.conversations });
        client.invalidateQueries({ queryKey: activityKeys.all });
      }
    },
  });

  const send = () => {
    if (!reason) {
      setMissingReason(true);
      return;
    }
    submit.mutate(reason);
  };

  if (submit.data) {
    const { blocked, blockFailed } = submit.data;
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
        <View style={styles.body}>
          <Text variant="h2" accessibilityRole="header">
            Thanks for telling us
          </Text>
          <Text color={colors.secondary}>
            {reviewLine} We won't tell {name} who reported them.
          </Text>
          {blocked ? (
            <Text color={colors.secondary}>
              You've blocked {name}, so you won't see each other again.
            </Text>
          ) : null}
          {blockFailed ? (
            <Text
              variant="bodySmall"
              color={colors.danger}
              accessibilityLiveRegion="polite"
            >
              Blocking didn't work. Your report was sent; you can still block{' '}
              {name} from their profile or chat.
            </Text>
          ) : null}
          <Button
            label="Done"
            // Once blocked, what was reported is gone from view, so leave it entirely.
            onPress={blocked ? navigation.popToTop : navigation.goBack}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <TopBar title="Report" onBack={navigation.goBack} />
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="h2" accessibilityRole="header">
          {titleFor(targetType, name)}
        </Text>
        <Text variant="bodySmall" color={colors.secondary}>
          {reviewLine}
        </Text>
        <View
          style={styles.reasons}
          accessibilityRole="radiogroup"
          accessibilityLabel="Reason"
        >
          {reportReasons.map(option => (
            <OptionCard
              key={option.reason}
              role="radio"
              title={option.label}
              checked={reason === option.reason}
              onChange={() => {
                setReason(option.reason);
                setMissingReason(false);
              }}
            />
          ))}
        </View>
        {missingReason ? (
          <Text
            variant="bodySmall"
            color={colors.danger}
            accessibilityLiveRegion="polite"
          >
            Choose a reason for your report.
          </Text>
        ) : null}
        <TextArea
          label="Details (optional)"
          placeholder="Anything that helps us understand what happened"
          value={details}
          onChangeText={setDetails}
          maxLength={detailsLimit}
        />
        <Text variant="caption" color={colors.secondary} style={styles.count}>
          {details.length}/{detailsLimit}
        </Text>
        <Checkbox
          checked={alsoBlock}
          onChange={setAlsoBlock}
          accessibilityLabel={`Also block ${name}, so you never see each other`}
        >
          Also block {name}, so you never see each other
        </Checkbox>
        {submit.error ? (
          <Text
            variant="bodySmall"
            color={colors.danger}
            accessibilityLiveRegion="polite"
          >
            {submit.error.message}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Button
            label="Submit report"
            variant="danger"
            loading={submit.isPending}
            onPress={send}
          />
          <Button label="Cancel" variant="text" onPress={navigation.goBack} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  body: {
    paddingHorizontal: layout.pageMargin,
    paddingBottom: layout.sectionGap,
    gap: layout.blockGap,
  },
  reasons: { gap: spacing.xs },
  count: { textAlign: 'right', marginTop: -spacing.xs },
  actions: { gap: spacing.xs },
});
