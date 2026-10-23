import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import {
  pickMedia,
  startVoiceNote,
  type MediaSource,
  type VoiceRecording,
} from './capture';
import {
  setMediaConsent,
  waitText,
  type ChatMediaLimits,
  type OutgoingMedia,
} from './media';
import { chatKeys, useMediaAllowance, useMediaState } from './queries';

// Media Consent for one chat: whether photos and video are open, and the line explaining why not.
export function useMediaConsent({
  connectionId,
  mode,
  accepted,
  otherName,
}: {
  connectionId: string;
  mode: string | undefined;
  accepted: boolean;
  otherName: string;
}) {
  const client = useQueryClient();
  const state = useMediaState(connectionId, mode, accepted);
  const change = useMutation({
    mutationFn: (on: boolean) => setMediaConsent(connectionId, on),
    onSettled: () =>
      client.invalidateQueries({
        queryKey: chatKeys.mediaStateAll(connectionId),
      }),
  });
  const casual = state.data?.isCasual ?? false;
  const mine = state.data?.mine ?? false;
  const theirs = state.data?.theirs ?? false;
  const visualsOff = casual && !(mine && theirs);
  const note = !casual
    ? null
    : !mine
    ? 'Photos and video are off in this chat. Switch on photos and video in the menu; they work once you both have.'
    : !theirs
    ? `Waiting for ${otherName} to allow photos and video too.`
    : null;
  return {
    casual,
    mine,
    visualsOff,
    note,
    // Links wait for the state, so the first batch is asked for under the right consent.
    known: !accepted || !state.isPending,
    setMine: (on: boolean) => change.mutate(on),
  };
}

// Today's media allowance in one chat (#183). `allow()` says whether a pick or a recording may
// start; when it may not, `wait` holds the line saying when the next one opens.
export function useMediaGate(connectionId: string, accepted: boolean) {
  const allowance = useMediaAllowance(connectionId, accepted);
  const [wait, setWait] = useState<string>();
  const nextAt = allowance.data?.nextAt;
  const usedUp =
    allowance.data?.remaining === 0 &&
    !!nextAt &&
    Date.parse(nextAt) > Date.now();
  const allow = () => {
    if (usedUp) {
      setWait(waitText(nextAt!));
      return false;
    }
    setWait(undefined);
    return true;
  };
  return { wait: usedUp ? wait : undefined, allow };
}

// The attach sheet: pick, compress and check, then hand the file to the chat to send.
export function useAttach(
  sendMedia: (media: OutgoingMedia) => void,
  limits: ChatMediaLimits,
) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const attach = async (source: MediaSource) => {
    setOpen(false);
    setError(undefined);
    try {
      const picked = await pickMedia(source, limits);
      if (picked) {
        sendMedia(picked);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return { open, setOpen, error, attach };
}

// Hold to record; letting go (or reaching the voice limit) sends.
export function useVoiceRecorder(
  sendMedia: (media: OutgoingMedia) => void,
  limitMs: number,
) {
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [error, setError] = useState<string>();
  const recording = useRef<Promise<VoiceRecording | null>>(null);
  const stop = async () => {
    const started = recording.current;
    recording.current = null;
    setElapsedMs(null);
    const note = await (await started)?.stop().catch(() => null);
    if (note) {
      sendMedia(note);
    }
  };
  const start = () => {
    setError(undefined);
    setElapsedMs(0);
    recording.current = startVoiceNote({
      limitMs,
      onTick: setElapsedMs,
      onLimit: () => {
        stop();
      },
    }).catch((e: Error) => {
      setError(e.message);
      setElapsedMs(null);
      return null;
    });
  };
  return { elapsedMs, error, start, stop };
}
