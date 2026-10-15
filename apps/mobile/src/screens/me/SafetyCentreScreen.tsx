import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Icon,
  List,
  ListRow,
  Screen,
  Text,
  TopBar,
} from '../../components';
import { supportEmail } from '../../features/me/api';
import type { MemberParams } from '../../navigation/types';
import { colors, layout, sizes, spacing } from '../../theme';
import { Section } from './Section';

type Props = NativeStackScreenProps<MemberParams, 'SafetyCentre'>;

const tips = [
  'Choose a public place for the first meeting.',
  'Tell a friend your plan and who you are meeting.',
  'Arrange your own way there and back.',
  'Leave if anything feels off. You never owe an explanation.',
];

// Reporting needs something to report, so this explains where the Report option lives
// rather than opening an empty form.
export function SafetyCentreScreen({ navigation }: Props) {
  return (
    <Screen
      header={
        <TopBar title="Safety Centre" onBack={() => navigation.goBack()} />
      }
    >
      <Section title="Before you meet">
        <Card style={styles.tips}>
          {tips.map(tip => (
            <View key={tip} style={styles.tip}>
              <Icon
                name="check"
                size={sizes.icon.inline}
                color={colors.orchid}
              />
              <Text style={styles.grow}>{tip}</Text>
            </View>
          ))}
        </Card>
      </Section>

      <Section title="Get help">
        <List>
          <ListRow
            title="Report a problem"
            subtitle="Open the menu on a profile, chat or Activity"
          />
          <ListRow
            title="Block someone"
            subtitle="From their profile or chat; see who you blocked"
            onPress={() => navigation.navigate('BlockedPeople')}
          />
          <ListRow
            title="Pause my profile"
            subtitle="Hidden from new people until you turn it back on"
            onPress={() => navigation.navigate('Settings')}
          />
        </List>
        <Text variant="bodySmall" color={colors.secondary}>
          To report someone, open the menu on their profile, chat or
          Activity, or press and hold a message, and choose Report. Reports are
          private and we look at each one within 24 hours.
        </Text>
      </Section>

      <Section title="In an emergency">
        <Card style={styles.tips}>
          <Text>
            If you are in danger, call the national emergency number first.
          </Text>
          <Button
            label="Call 112"
            onPress={() => Linking.openURL('tel:112')}
          />
        </Card>
      </Section>

      <Button
        label="Contact support"
        variant="secondary"
        onPress={() => Linking.openURL(`mailto:${supportEmail}`)}
      />
      <Text
        variant="bodySmall"
        color={colors.secondary}
        style={styles.centred}
      >
        We reply to safety reports within 24 hours.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tips: { gap: spacing.sm },
  tip: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  grow: { flex: 1 },
  centred: { textAlign: 'center', marginTop: -layout.blockGap / 2 },
});
