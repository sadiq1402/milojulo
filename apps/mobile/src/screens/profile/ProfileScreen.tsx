import { useNavigation } from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Button,
  IconButton,
  PhotoPlaceholder,
  Tag,
  Text,
  TopBar,
} from '../../components';
import { usePhotoUrl } from '../../features/photos/queries';
import { chatKeys, useConversations } from '../../features/chat/queries';
import type { Profile } from '../../features/discover/api';
import {
  useAreaNames,
  usePromptQuestions,
  useTagNames,
} from '../../features/catalog/queries';
import { useProfile } from '../../features/discover/queries';
import { modeLabels } from '../../features/modes';
import { useBlockMember } from '../../features/me/queries';
import type { MemberParams } from '../../navigation/types';
import { colors, layout, radius, shadow, sizes, spacing } from '../../theme';
import { SendRequestSheet } from '../requests/SendRequestSheet';
import { ProfileMenu } from './ProfileMenu';

type Props = NativeStackScreenProps<MemberParams, 'Profile'>;

export function ProfileScreen({ navigation, route }: Props) {
  const { memberId } = route.params;
  const profile = useProfile(memberId);
  const member = profile.data;
  const [menuOpen, setMenuOpen] = useState(false);
  const block = useBlockMember();

  const blockAndLeave = async () => {
    await block(memberId);
    setMenuOpen(false);
    navigation.goBack();
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <TopBar
        onBack={navigation.goBack}
        right={
          profile.data ? (
            <IconButton
              icon="more"
              accessibilityLabel="Profile menu"
              onPress={() => setMenuOpen(true)}
            />
          ) : null
        }
      />
      {profile.isError ? (
        <View style={styles.message}>
          <Text color={colors.danger}>{profile.error.message}</Text>
          <Button
            label="Try again"
            variant="text"
            compact
            onPress={() => profile.refetch()}
          />
        </View>
      ) : profile.data === null ? (
        <View style={styles.message}>
          <Text color={colors.secondary}>
            This profile isn't available any more.
          </Text>
        </View>
      ) : member ? (
        <>
          <ProfileBody profile={member} />
          <ProfileAction profile={member} />
          <ProfileMenu
            visible={menuOpen}
            onClose={() => setMenuOpen(false)}
            name={member.name}
            onBlock={blockAndLeave}
            onReport={() =>
              navigation.navigate('Report', {
                targetType: 'profile',
                targetId: memberId,
                memberId,
                memberName: member.name,
              })
            }
          />
        </>
      ) : (
        <ActivityIndicator color={colors.orchid} />
      )}
    </SafeAreaView>
  );
}

function ProfileBody({ profile }: { profile: Profile }) {
  const navigation = useNavigation<NativeStackNavigationProp<MemberParams>>();
  const heroPhotoId = profile.photoIds[0];
  const hero = usePhotoUrl(heroPhotoId);
  const reportPhoto = () =>
    navigation.navigate('Report', {
      targetType: 'photo',
      targetId: heroPhotoId,
      memberId: profile.id,
      memberName: profile.name,
    });
  const areas = useAreaNames();
  const tags = useTagNames();
  const questions = usePromptQuestions();
  const areaName = areas.data?.[profile.areaId];
  const tagLabels = profile.tagIds
    .map(id => tags.data?.[id])
    .filter((label): label is string => Boolean(label));

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Pressable
        disabled={!heroPhotoId}
        onLongPress={reportPhoto}
        accessibilityActions={
          heroPhotoId ? [{ name: 'report', label: 'Report photo' }] : undefined
        }
        onAccessibilityAction={e =>
          e.nativeEvent.actionName === 'report' && reportPhoto()
        }
        accessibilityLabel={`${profile.name}'s photo`}
        accessibilityHint={heroPhotoId ? 'Long-press to report' : undefined}
      >
        <PhotoPlaceholder
          name={profile.name}
          seed={profile.id}
          initialSize={heroInitialSize}
          uri={hero.data}
          style={styles.hero}
        >
          {areaName ? (
            <View style={styles.area}>
              <Tag label={areaName} tone="onPhoto" />
            </View>
          ) : null}
          <View style={styles.modes}>
            {profile.modes.map(mode => (
              <Tag key={mode} label={modeLabels[mode]} tone={mode} />
            ))}
          </View>
        </PhotoPlaceholder>
      </Pressable>
      <Text variant="h1" accessibilityRole="header">
        {profile.name}, {profile.age}
      </Text>
      <View style={styles.why}>
        <Text variant="title">Why you match</Text>
        <Text>{profile.whyYouMatch}</Text>
      </View>
      {profile.prompts.map((prompt, i) => (
        <View
          key={prompt.position}
          style={[styles.prompt, i % 2 === 1 && styles.promptAlt]}
        >
          <Text variant="bodySmall" color={colors.secondary}>
            {questions.data?.[prompt.questionId] ?? ''}
          </Text>
          <Text variant="h2">{prompt.answer}</Text>
        </View>
      ))}
      {tagLabels.length > 0 ? (
        <View style={styles.section}>
          <Text variant="title">Interests</Text>
          <View style={styles.tags}>
            {tagLabels.map(label => (
              <Tag key={label} label={label} />
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

// Send request, or what's already between us: an open chat or a request waiting for an answer.
function ProfileAction({ profile }: { profile: Profile }) {
  const navigation = useNavigation<NativeStackNavigationProp<MemberParams>>();
  const client = useQueryClient();
  const conversations = useConversations();
  const [sheetOpen, setSheetOpen] = useState(false);
  const existing = conversations.data?.find(
    c =>
      c.otherId === profile.id &&
      (c.status === 'requested' || c.status === 'accepted'),
  );

  if (conversations.isPending) {
    return null;
  }
  return (
    <View style={styles.action}>
      {existing?.status === 'accepted' ? (
        <Button
          label="Open chat"
          onPress={() =>
            navigation.navigate('Chat', {
              connectionId: existing.connectionId,
            })
          }
        />
      ) : existing?.direction === 'outgoing' ? (
        <Button label="Request sent" disabled onPress={() => {}} />
      ) : existing ? (
        <Text color={colors.secondary} style={styles.received}>
          {profile.name} has sent you a Connection Request. Answer it in Inbox.
        </Text>
      ) : (
        <Button label="Send request" onPress={() => setSheetOpen(true)} />
      )}
      <SendRequestSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        member={{
          id: profile.id,
          name: profile.name,
          modes: profile.requestModes,
          sharedModes: profile.modes,
        }}
        onSent={() =>
          client.invalidateQueries({ queryKey: chatKeys.conversations })
        }
      />
    </View>
  );
}

// Initial sized to the hero as in the mockup.
const heroInitialSize = Math.round(sizes.photo.heroH * 0.39);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  message: { paddingHorizontal: layout.pageMargin, gap: spacing.xs },
  body: {
    paddingHorizontal: layout.pageMargin,
    paddingBottom: layout.sectionGap,
    gap: layout.blockGap,
  },
  hero: {
    aspectRatio: sizes.photo.heroW / sizes.photo.heroH,
    borderRadius: radius.r32,
  },
  area: { position: 'absolute', left: spacing.sm, bottom: spacing.sm },
  modes: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    gap: spacing.xxs,
  },
  why: {
    backgroundColor: colors.butter,
    borderRadius: radius.r24,
    padding: layout.cardPadding,
    gap: spacing.xxs,
  },
  prompt: {
    backgroundColor: colors.tint,
    borderRadius: radius.r24,
    padding: layout.cardPadding,
    gap: spacing.xxs,
  },
  promptAlt: { backgroundColor: colors.lilacSoft },
  section: { gap: spacing.xs },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs },
  action: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.r28,
    borderTopRightRadius: radius.r28,
    paddingTop: spacing.sm,
    paddingHorizontal: layout.pageMargin,
    paddingBottom: spacing.sm,
    ...shadow('tabBar'),
  },
  received: { textAlign: 'center' },
});
