import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet, Button, Card, Icon, Text } from '../../components';
import {
  deletePhoto,
  maxPhotos,
  movePhoto,
  uploadPhoto,
  type MyPhoto,
} from '../../features/photos/api';
import { pickPhoto, type PhotoSource } from '../../features/photos/picker';
import { photoKeys, useMyPhotos } from '../../features/photos/queries';
import { minPhotos } from '../../features/profileSetup/model';
import { colors, layout, sizes, spacing } from '../../theme';
import { PhotoSlot, type UploadState } from './PhotoSlot';
import { SetupStepScreen, type StepProps } from './SetupStepScreen';

type Sheet =
  | { kind: 'add'; position: number }
  | { kind: 'photo'; index: number };

// Each slot shows a confirmed photo, an upload in flight at a free position, or "Add photo".
type Slot =
  | { kind: 'photo'; photo: MyPhoto; upload?: UploadState }
  | { kind: 'upload'; position: number; upload: UploadState }
  | { kind: 'empty' };

export function PhotosStep({ onDone, onBack, notice }: StepProps) {
  const client = useQueryClient();
  const photos = useMyPhotos();
  const list = photos.data ?? [];
  // Keyed by the position being uploaded to (a replacement shares its photo's position).
  const [uploads, setUploads] = useState<Record<number, UploadState>>({});
  // Photo id → the local file it was uploaded from, shown instead of fetching a link.
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [error, setError] = useState<string>();

  const refresh = () => client.invalidateQueries({ queryKey: photoKeys.mine });
  const dropUpload = (position: number) =>
    setUploads(({ [position]: _, ...rest }) => rest);

  async function upload(position: number, localUri: string) {
    setUploads(current => ({ ...current, [position]: { localUri } }));
    try {
      const photoId = await uploadPhoto(position, localUri);
      setPreviews(current => ({ ...current, [photoId]: localUri }));
      await refresh();
      dropUpload(position);
    } catch (e) {
      setUploads(current => ({
        ...current,
        [position]: { localUri, failed: (e as Error).message },
      }));
    }
  }

  async function choose(source: PhotoSource, position: number) {
    setSheet(null);
    setError(undefined);
    try {
      const localUri = await pickPhoto(source);
      if (localUri) {
        await upload(position, localUri);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const change = useMutation({
    mutationFn: (action: () => Promise<void>) => action(),
    onMutate: () => {
      setSheet(null);
      setError(undefined);
    },
    onSettled: () => refresh(),
    onError: e => setError(e.message),
  });

  const taken = new Set([
    ...list.map(photo => photo.position),
    ...Object.keys(uploads).map(Number),
  ]);
  const nextFree = [1, 2, 3, 4].find(p => !taken.has(p));
  const slots: Slot[] = [
    ...list.map(photo => ({
      kind: 'photo' as const,
      photo,
      upload: uploads[photo.position],
    })),
    ...Object.entries(uploads)
      .map(([position, state]) => ({ position: Number(position), state }))
      .filter(({ position }) => !list.some(p => p.position === position))
      .sort((a, b) => a.position - b.position)
      .map(({ position, state }) => ({
        kind: 'upload' as const,
        position,
        upload: state,
      })),
  ];
  while (slots.length < maxPhotos) {
    slots.push({ kind: 'empty' });
  }
  const uploading = Object.values(uploads).some(state => !state.failed);

  const renderSlot = (slot: Slot, index: number) => {
    switch (slot.kind) {
      case 'photo':
        return (
          <PhotoSlot
            key={slot.photo.id}
            index={index}
            photoId={slot.photo.id}
            localUri={previews[slot.photo.id]}
            upload={slot.upload}
            onPress={() => setSheet({ kind: 'photo', index })}
            onRetry={() => upload(slot.photo.position, slot.upload!.localUri)}
            onDiscard={() => dropUpload(slot.photo.position)}
          />
        );
      case 'upload':
        return (
          <PhotoSlot
            key={`upload-${slot.position}`}
            index={index}
            upload={slot.upload}
            onPress={() => {}}
            onRetry={() => upload(slot.position, slot.upload.localUri)}
            onDiscard={() => dropUpload(slot.position)}
          />
        );
      default:
        return (
          <PhotoSlot
            key={`empty-${index}`}
            index={index}
            onPress={() =>
              nextFree && setSheet({ kind: 'add', position: nextFree })
            }
          />
        );
    }
  };

  const selected = sheet?.kind === 'photo' ? list[sheet.index] : undefined;
  const selectedIndex = sheet?.kind === 'photo' ? sheet.index : -1;

  return (
    <SetupStepScreen
      step="photos"
      title="Add 2 to 4 photos"
      intro="Clear photos where your face is visible."
      onBack={onBack}
      error={error ?? (photos.isError ? photos.error.message : notice)}
      onNext={onDone}
      nextDisabled={list.length < minPhotos || uploading || change.isPending}
      saving={false}
    >
      <View style={styles.grid}>
        {[0, 2].map(row => (
          <View key={row} style={styles.row}>
            {slots
              .slice(row, row + 2)
              .map((slot, i) => renderSlot(slot, row + i))}
          </View>
        ))}
      </View>
      <Card style={styles.tip}>
        <Icon name="camera" size={sizes.icon.inline} color={colors.orchid} />
        <Text
          variant="bodySmall"
          color={colors.orchidDark}
          style={styles.tipText}
        >
          Your first photo is your main photo. Tap a photo to move, replace or
          remove it.
        </Text>
      </Card>

      <BottomSheet
        visible={sheet?.kind === 'add'}
        onClose={() => setSheet(null)}
      >
        <Text variant="h2" accessibilityRole="header">
          Add a photo
        </Text>
        <Button
          label="Take a photo"
          variant="secondary"
          onPress={() =>
            sheet?.kind === 'add' && choose('camera', sheet.position)
          }
        />
        <Button
          label="Choose from your photos"
          variant="secondary"
          onPress={() =>
            sheet?.kind === 'add' && choose('library', sheet.position)
          }
        />
      </BottomSheet>

      <BottomSheet
        visible={sheet?.kind === 'photo'}
        onClose={() => setSheet(null)}
      >
        <Text variant="h2" accessibilityRole="header">
          {selectedIndex === 0 ? 'Main photo' : `Photo ${selectedIndex + 1}`}
        </Text>
        {selected && selectedIndex > 0 ? (
          <Button
            label="Make main photo"
            variant="secondary"
            onPress={() =>
              change.mutate(() => movePhoto(selected.id, list[0].position))
            }
          />
        ) : null}
        {selected && selectedIndex > 1 ? (
          <Button
            label="Move earlier"
            variant="secondary"
            onPress={() =>
              change.mutate(() =>
                movePhoto(selected.id, list[selectedIndex - 1].position),
              )
            }
          />
        ) : null}
        {selected && selectedIndex < list.length - 1 ? (
          <Button
            label="Move later"
            variant="secondary"
            onPress={() =>
              change.mutate(() =>
                movePhoto(selected.id, list[selectedIndex + 1].position),
              )
            }
          />
        ) : null}
        {selected ? (
          <Button
            label="Replace photo"
            variant="secondary"
            onPress={() =>
              setSheet({ kind: 'add', position: selected.position })
            }
          />
        ) : null}
        {selected ? (
          <Button
            label="Remove photo"
            variant="danger"
            onPress={() => change.mutate(() => deletePhoto(selected.id))}
          />
        ) : null}
      </BottomSheet>
    </SetupStepScreen>
  );
}

const styles = StyleSheet.create({
  grid: { gap: layout.gridGutter },
  row: { flexDirection: 'row', gap: layout.gridGutter },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.selected,
  },
  tipText: { flex: 1 },
});
