import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Sound from 'react-native-nitro-sound';
import Video from 'react-native-video';
import { Icon, Text } from '../../components';
import type { ChatItem } from '../../features/chat/useChat';
import { colors, radius, sizes, spacing } from '../../theme';

type Props = {
  item: ChatItem;
  mine: boolean;
  // The signed link; undefined while loading or when it isn't viewable.
  url?: string;
  urlsLoading: boolean;
  // Media Consent is off, so the link is withheld (not expired).
  off?: boolean;
};

const width = sizes.chat.mediaMaxW;
const height = (width * 3) / 4;

export function formatDuration(ms: number | null): string {
  const total = Math.round((ms ?? 0) / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// The file inside a media bubble: a photo or video 240 wide at 4:3, or a voice note.
export function MediaContent({
  item,
  mine,
  url,
  urlsLoading,
  off = false,
}: Props) {
  const ink = mine ? colors.white : colors.ink;
  if (item.media?.expired) {
    return (
      <Text variant="bodySmall" color={mine ? colors.white : colors.secondary}>
        Media expired
      </Text>
    );
  }
  const uri = item.localUri ?? url;
  if (!uri) {
    return (
      <View style={[styles.frame, styles.empty]}>
        <Text variant="bodySmall" color={colors.secondary}>
          {off
            ? 'Media is off in this chat'
            : urlsLoading
            ? 'Loading…'
            : 'Media unavailable'}
        </Text>
      </View>
    );
  }
  if (item.type === 'voice') {
    return (
      <VoiceNote uri={uri} durationMs={item.media?.durationMs ?? 0} ink={ink} />
    );
  }
  if (item.type === 'video') {
    return <VideoClip uri={uri} />;
  }
  return (
    <Image
      source={{ uri }}
      accessibilityLabel="Photo"
      style={styles.frame}
      resizeMode="cover"
    />
  );
}

function VideoClip({ uri }: { uri: string }) {
  const [started, setStarted] = useState(false);
  return (
    <View style={styles.frame}>
      <Video
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        paused={!started}
        controls={started}
        accessibilityLabel="Video"
      />
      {started ? null : (
        <Pressable
          onPress={() => setStarted(true)}
          accessibilityRole="button"
          accessibilityLabel="Play video"
          style={styles.playOverlay}
        >
          <View style={styles.playDisc}>
            <Icon name="play" color={colors.white} />
          </View>
        </Pressable>
      )}
    </View>
  );
}

// One voice note plays at a time (the sound player is shared).
function VoiceNote({
  uri,
  durationMs,
  ink,
}: {
  uri: string;
  durationMs: number;
  ink: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const playingRef = useRef(false);
  // Leaving the chat stops a note still playing.
  useEffect(
    () => () => {
      if (playingRef.current) {
        Sound.removePlayBackListener();
        Sound.removePlaybackEndListener();
        Sound.stopPlayer().catch(() => {});
      }
    },
    [],
  );
  const stop = () => {
    Sound.removePlayBackListener();
    Sound.removePlaybackEndListener();
    playingRef.current = false;
    setPlaying(false);
    setPosition(0);
  };
  const toggle = async () => {
    if (playing) {
      await Sound.stopPlayer().catch(() => {});
      stop();
      return;
    }
    Sound.addPlayBackListener(({ currentPosition }) =>
      setPosition(currentPosition),
    );
    Sound.addPlaybackEndListener(stop);
    playingRef.current = true;
    setPlaying(true);
    try {
      await Sound.startPlayer(uri);
    } catch {
      stop();
    }
  };
  const shown = formatDuration(playing ? position : durationMs);
  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={`${
        playing ? 'Stop' : 'Play'
      } voice message, ${formatDuration(durationMs)}`}
      style={styles.voice}
    >
      <View style={[styles.voiceDisc, { borderColor: ink }]}>
        <Icon
          name={playing ? 'pause' : 'play'}
          size={sizes.icon.tiny}
          color={ink}
        />
      </View>
      <Text variant="bodySmall" color={ink}>
        {shown}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    width,
    height,
    maxWidth: '100%',
    borderRadius: radius.r16,
    overflow: 'hidden',
    backgroundColor: colors.field,
  },
  empty: { alignItems: 'center', justifyContent: 'center' },
  playOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playDisc: {
    width: sizes.iconButton,
    height: sizes.iconButton,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.scrim,
  },
  voice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: sizes.hitArea,
    minWidth: 120,
  },
  voiceDisc: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
