import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet, Button, Card, Icon, Text } from '../../components';
import { deletePhoto, movePhoto, uploadPhoto } from '../../features/photos/api';
import {
  maxPhotos,
  photoPositions,
  type MyPhoto,
} from '../../features/photos/model';
import { pickPhotos, type PhotoSource } from '../../features/photos/picker';
import { photoKeys, useMyPhotos } from '../../features/photos/queries';
import { minPhotos } from '../../features/profileSetup/model';
import { colors, layout, sizes, spacing } from '../../theme';
import { PhotoSlot, type UploadState } from './PhotoSlot';
import { SetupStepScreen, useNotice, type StepProps } from './SetupStepScreen';

type Sheet =
  | { kind: 'add'; position: number }
  | { kind: 'photo'; index: number };

// Each slot shows a confirmed photo, an upload in flight at a free position, or "Add photo".
type Slot =
  | { kind: 'photo'; photo: MyPhoto; upload?: UploadState }
  | { kind: 'upload'; position: number; upload: UploadState }
  | { kind: 'empty' };

type Upload = { position: number; localUri: string };
// The free slots to fill, the tapped one first.
type ChoosePhotos = { source: PhotoSource; free: number[] };

export const waitForUpload = 'Wait for the photo to finish uploading.';

export function PhotosStep({
  onDone,
  onBack,
  notice,
  beforeLeave,
  editing,
}: StepProps) {
  const client = useQueryClient();
  const photos = useMyPhotos();
  const list = photos.data ?? [];
  // Keyed by the position being uploaded to (a replacement shares its photo's position).
  const [uploads, setUploads] = useState<Record<number, UploadState>>({});
  // Photo id → the local file it was uploaded from, shown instead of fetching a link.
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [sheet, setSheet] = useState<Sheet | null>(null);
  // Set when the picker hands back more photos than there are slots (#197).
  const [tooMany, setTooMany] = useState<string>();
  const shownNotice = useNotice(notice, {
    photos: list,
    uploads: Object.keys(uploads),
  });

  const uploading = Object.values(uploads).some(state => !state.failed);
  const refresh = () => client.invalidateQueries({ queryKey: photoKeys.mine });
  const dropUpload = (position: number) =>
    setUploads(({ [position]: _, ...rest }) => rest);

  // Leaving waits for uploads, so none lands after the step is gone.
  useEffect(() => {
    beforeLeave.current = async () => {
      if (uploading) {
        throw new Error(waitForUpload);
      }
    };
  });

  // One mutation runs per upload; its callbacks get that upload's variables.
  const upload = useMutation({
    mutationFn: ({ position, localUri }: Upload) =>
      uploadPhoto(position, localUri),
    onMutate: ({ position, localUri }) =>
      setUploads(current => ({ ...current, [position]: { localUri } })),
    onSuccess: async (photoId, { position, localUri }) => {
      setPreviews(current => ({ ...current, [photoId]: localUri }));
      await refresh();
      dropUpload(position);
    },
    onError: (error, { position, localUri }) =>
      setUploads(current => ({
        ...current,
        [position]: { localUri, failed: error.message },
      })),
  });

  // The gallery may be asked for as many photos as there are free slots; each fills the next
  // one, starting with the slot that was tapped (#197).
  const choose = useMutation({
    mutationFn: ({ source, free }: ChoosePhotos) =>
      pickPhotos(source, free.length),
    onMutate: () => {
      setSheet(null);
      setTooMany(undefined);
      move.reset();
      remove.reset();
    },
    onSuccess: ({ uris, chosen }, { free }) => {
      setTooMany(
        chosen > free.length
          ? free.length === 1
            ? 'Only 1 more photo fits, so we added the first.'
            : `Only ${free.length} more photos fit, so we added the first ${free.length}.`
          : undefined,
      );
      uris.slice(0, free.length).forEach((localUri, i) => {
        upload.mutate({ position: free[i]!, localUri });
      });
    },
  });

  const move = useMutation({
    mutationFn: ({
      photoId,
      position,
    }: {
      photoId: string;
      position: number;
    }) => movePhoto(photoId, position),
    onMutate: () => {
      setSheet(null);
      choose.reset();
      remove.reset();
    },
    onSettled: () => refresh(),
  });

  const remove = useMutation({
    mutationFn: (photoId: string) => deletePhoto(photoId),
    onMutate: () => {
      setSheet(null);
      choose.reset();
      move.reset();
    },
    onSettled: () => refresh(),
  });

  const changing = move.isPending || remove.isPending;
  const taken = new Set([
    ...list.map(photo => photo.position),
    ...Object.keys(uploads).map(Number),
  ]);
  const nextFree = photoPositions.find(p => !taken.has(p));
  // The tapped slot first, then the rest, so a multiple choice fills them in order.
  const freeFrom = (position: number) => [
    position,
    ...photoPositions.filter(p => p !== position && !taken.has(p)),
  ];
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
            disabled={uploading || changing}
            onPress={() => setSheet({ kind: 'photo', index })}
            onRetry={() =>
              upload.mutate({
                position: slot.photo.position,
                localUri: slot.upload!.localUri,
              })
            }
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
            onRetry={() =>
              upload.mutate({
                position: slot.position,
                localUri: slot.upload.localUri,
              })
            }
            onDiscard={() => dropUpload(slot.position)}
          />
        );
      default:
        return (
          <PhotoSlot
            key={`empty-${index}`}
            index={index}
            disabled={changing}
            onPress={() =>
              nextFree && setSheet({ kind: 'add', position: nextFree })
            }
          />
        );
    }
  };

  const selected = sheet?.kind === 'photo' ? list[sheet.index] : undefined;
  const selectedIndex = sheet?.kind === 'photo' ? sheet.index : -1;
  const moveTo = (position: number) =>
    selected && move.mutate({ photoId: selected.id, position });
  // A failed upload's reason shows here; its slot keeps just Retry and Cancel, which fit at 130%.
  const uploadFailure = Object.values(uploads).find(state => state.failed);
  const error =
    uploadFailure?.failed ??
    tooMany ??
    choose.error?.message ??
    move.error?.message ??
    remove.error?.message ??
    (photos.isError ? photos.error.message : undefined) ??
    shownNotice;

  return (
    <SetupStepScreen
      step="photos"
      editing={editing}
      title="Add 2 to 4 photos"
      intro="Clear photos where your face is visible."
      onBack={uploading ? undefined : onBack}
      error={error}
      onNext={onDone}
      nextDisabled={list.length < minPhotos || uploading || changing}
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
            sheet?.kind === 'add' &&
            choose.mutate({ source: 'camera', free: freeFrom(sheet.position) })
          }
        />
        <Button
          label="Choose from your photos"
          variant="secondary"
          onPress={() =>
            sheet?.kind === 'add' &&
            choose.mutate({ source: 'library', free: freeFrom(sheet.position) })
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
            onPress={() => moveTo(list[0].position)}
          />
        ) : null}
        {selected && selectedIndex > 1 ? (
          <Button
            label="Move earlier"
            variant="secondary"
            onPress={() => moveTo(list[selectedIndex - 1].position)}
          />
        ) : null}
        {selected && selectedIndex < list.length - 1 ? (
          <Button
            label="Move later"
            variant="secondary"
            onPress={() => moveTo(list[selectedIndex + 1].position)}
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
            onPress={() => remove.mutate(selected.id)}
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
