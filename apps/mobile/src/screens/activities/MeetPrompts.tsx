import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Avatar, List, ListRow, Text } from '../../components';
import { usePendingFeedback } from '../../features/meetFeedback/queries';
import type { MemberParams } from '../../navigation/types';
import { spacing } from '../../theme';

// After an Activity ends, one row per person to answer about; nothing while loading or on error.
export function MeetPrompts() {
  const navigation = useNavigation<NativeStackNavigationProp<MemberParams>>();
  const pending = usePendingFeedback();
  if (!pending.data?.length) {
    return null;
  }
  return (
    <View style={styles.section}>
      <Text variant="h2" accessibilityRole="header">
        After you met
      </Text>
      <List>
        {pending.data.map(row => (
          <ListRow
            key={`${row.activityId}:${row.otherUserId}`}
            left={<Avatar name={row.otherName} />}
            title={`Did you meet ${row.otherName}?`}
            subtitle={row.activityTitle}
            accessibilityLabel={`Did you meet ${row.otherName} at ${row.activityTitle}?`}
            onPress={() =>
              navigation.navigate('MeetFeedback', {
                otherUserId: row.otherUserId,
                otherName: row.otherName,
                activityId: row.activityId,
                activityTitle: row.activityTitle,
              })
            }
          />
        ))}
      </List>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs, marginBottom: spacing.md },
});
