import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Avatar,
  Button,
  Icon,
  OptionCard,
  Text,
  TopBar,
} from '../../components';
import { endedWhen } from '../../features/activities/time';
import { AlreadyAnsweredError } from '../../features/meetFeedback/api';
import { useSubmitMeetFeedback } from '../../features/meetFeedback/queries';
import type { MemberParams } from '../../navigation/types';
import { colors, layout, radius, sizes, spacing } from '../../theme';

type Props = NativeStackScreenProps<MemberParams, 'MeetFeedback'>;

const privateNote =
  'Only you see your answer. A connection counts as kept when you both say yes.';

function Question({
  title,
  options,
  value,
  onChange,
  level,
}: {
  title: string;
  options: { label: string; description?: string; value: boolean }[];
  value: boolean | undefined;
  onChange: (value: boolean) => void;
  level: 'h1' | 'h2';
}) {
  return (
    <>
      <Text variant={level} accessibilityRole="header">
        {title}
      </Text>
      <View
        style={styles.options}
        accessibilityRole="radiogroup"
        accessibilityLabel={title}
      >
        {options.map(option => (
          <OptionCard
            key={option.label}
            role="radio"
            title={option.label}
            description={option.description}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
        ))}
      </View>
    </>
  );
}

export function MeetFeedbackScreen({ navigation, route }: Props) {
  const { otherUserId, otherName, activityId, activityTitle, endsAt } =
    route.params;
  const submit = useSubmitMeetFeedback();
  const [didMeet, setDidMeet] = useState<boolean>();
  const [keep, setKeep] = useState<boolean>();
  const [tried, setTried] = useState(false);
  // Once both are chosen the reminder goes by itself.
  const missing = tried && (didMeet === undefined || keep === undefined);
  const alreadyAnswered = submit.error instanceof AlreadyAnsweredError;

  const send = () => {
    setTried(true);
    if (didMeet === undefined || keep === undefined) {
      return;
    }
    submit.mutate({
      otherUserId,
      ...(activityId ? { activityId } : {}),
      didMeet,
      keep,
    });
  };

  if (submit.isSuccess || alreadyAnswered) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
        <View style={styles.body}>
          <Text variant="h2" accessibilityRole="header">
            Thanks for telling us
          </Text>
          <Text color={colors.secondary}>
            {alreadyAnswered
              ? "You'd already answered about this one."
              : privateNote}
          </Text>
          <Button label="Done" onPress={navigation.goBack} />
        </View>
      </SafeAreaView>
    );
  }

  const when = endsAt ? ` · ${endedWhen(endsAt)}` : '';

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <TopBar onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.who}>
          <Avatar name={otherName} size="sheet" />
          <View style={styles.fill}>
            <Text variant="title">{activityTitle ?? otherName}</Text>
            {activityTitle ? (
              <Text variant="bodySmall" color={colors.secondary}>
                with {otherName}
                {when}
              </Text>
            ) : null}
          </View>
        </View>
        <Question
          level="h1"
          title="Did you two meet?"
          value={didMeet}
          onChange={setDidMeet}
          options={[
            { label: 'Yes, we met', value: true },
            { label: 'Not this time', value: false },
          ]}
        />
        <Question
          level="h2"
          title="Keep the connection?"
          value={keep}
          onChange={setKeep}
          options={[
            {
              label: 'Yes, keep it',
              description: 'Stay connected and chat any time',
              value: true,
            },
            {
              label: 'Not for me',
              description: `${otherName} isn't told`,
              value: false,
            },
          ]}
        />
        <View style={styles.note}>
          <Icon name="check" size={sizes.icon.inline} color={colors.orchid} />
          <Text
            variant="bodySmall"
            color={colors.orchidDark}
            style={styles.fill}
          >
            {privateNote}
          </Text>
        </View>
        {missing || submit.error ? (
          <Text
            variant="bodySmall"
            color={colors.danger}
            accessibilityLiveRegion="polite"
          >
            {missing ? 'Answer both questions first.' : submit.error?.message}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Button label="Submit" loading={submit.isPending} onPress={send} />
          <Button
            label="Something went wrong? Report it"
            variant="text"
            onPress={() =>
              navigation.navigate('Report', {
                targetType: 'profile',
                targetId: otherUserId,
                memberId: otherUserId,
                memberName: otherName,
              })
            }
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  body: {
    paddingHorizontal: layout.pageMargin,
    paddingTop: spacing.xs,
    paddingBottom: layout.sectionGap,
    gap: layout.blockGap,
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  fill: { flex: 1 },
  options: { gap: spacing.xs },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: layout.cardPadding,
    borderRadius: radius.r24,
    backgroundColor: colors.selected,
  },
  actions: { gap: spacing.xxs },
});
