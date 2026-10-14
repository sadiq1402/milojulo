import React from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Icon, Tag, Text } from '../../components';
import { usePhotoUrl } from '../../features/photos/queries';
import {
  colors,
  fontFamily,
  fonts,
  photoTones,
  radius,
  sizes,
  spacing,
} from '../../theme';

export type UploadState = { localUri: string; failed?: string };

type Props = {
  index: number;
  photoId?: string;
  // The file just picked or uploaded, shown until (and instead of) the signed link.
  localUri?: string;
  upload?: UploadState;
  onPress: () => void;
  onRetry?: () => void;
  onDiscard?: () => void;
};

// One 4:5 upload slot (169 x 211 on a 390 screen, radius 20); the first is the cover.
export function PhotoSlot({
  index,
  photoId,
  localUri,
  upload,
  onPress,
  onRetry,
  onDiscard,
}: Props) {
  const signed = usePhotoUrl(localUri || upload ? null : photoId);
  const uri = upload?.localUri ?? localUri ?? signed.data ?? undefined;
  const filled = !!photoId || !!upload;

  if (!filled) {
    return (
      <View style={styles.slotWrap}>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel="Add photo"
          style={({ pressed }) => [
            styles.slot,
            styles.empty,
            pressed && styles.pressed,
          ]}
        >
          <Icon name="plus" size={sizes.icon.default} color={colors.orchid} />
          <Text variant="bodySmall" color={colors.orchid} style={styles.add}>
            Add photo
          </Text>
        </Pressable>
      </View>
    );
  }

  const busy = !!upload && !upload.failed;
  return (
    <View style={styles.slotWrap}>
      <Pressable
        onPress={onPress}
        disabled={!!upload}
        accessibilityRole="button"
        accessibilityLabel={
          index === 0 ? `Photo ${index + 1}, main photo` : `Photo ${index + 1}`
        }
        accessibilityHint="Move, replace or remove this photo"
        accessibilityState={{ busy, disabled: !!upload }}
        style={[
          styles.slot,
          { backgroundColor: photoTones[index % photoTones.length] },
        ]}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            accessibilityIgnoresInvertColors
          />
        ) : null}
        {index === 0 && !upload ? (
          <View style={styles.cover}>
            <Tag label="Main photo" tone="butter" />
          </View>
        ) : null}
      </Pressable>
      {busy ? (
        <View style={styles.overlay}>
          <ActivityIndicator color={colors.white} />
          <Text
            variant="bodySmall"
            color={colors.white}
            accessibilityLiveRegion="polite"
          >
            Uploading…
          </Text>
        </View>
      ) : null}
      {upload?.failed ? (
        <View style={styles.overlay}>
          <Text
            variant="bodySmall"
            color={colors.white}
            style={styles.failed}
            accessibilityLiveRegion="polite"
          >
            {upload.failed}
          </Text>
          <Button
            label="Retry"
            compact
            variant="secondary"
            accessibilityLabel={`Retry photo ${index + 1}`}
            onPress={onRetry!}
            style={styles.overlayButton}
          />
          <Button
            label="Cancel"
            compact
            variant="secondary"
            accessibilityLabel={`Cancel photo ${index + 1}`}
            onPress={onDiscard!}
            style={styles.overlayButton}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  slotWrap: { flex: 1 },
  slot: {
    width: '100%',
    aspectRatio: sizes.photo.slotW / sizes.photo.slotH,
    borderRadius: radius.r20,
    overflow: 'hidden',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.field,
    backgroundColor: colors.card,
  },
  add: { fontFamily: fontFamily(fonts.text, '600') },
  pressed: { backgroundColor: colors.tint },
  cover: { position: 'absolute', left: spacing.xs, bottom: spacing.xs },
  overlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.r20,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
  },
  failed: { textAlign: 'center' },
  overlayButton: { alignSelf: 'center' },
});
