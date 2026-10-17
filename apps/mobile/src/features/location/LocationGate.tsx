import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Linking } from 'react-native';
import {
  LocationOffScreen,
  LocationScreen,
} from '../../screens/location/LocationScreens';
import { useSession } from '../auth/SessionProvider';
import { useAreaName } from '../catalog/queries';
import { useProfileDraft } from '../profileSetup/queries';
import { setLocation } from './api';
import { currentPosition, hasPermission, requestPermission } from './device';
import {
  clock,
  loadRecord,
  saveRecord,
  shouldPrompt,
  shouldRefresh,
  type PromptRecord,
} from './prompt';

type Step = 'loading' | 'prompt' | 'off' | 'app';

// In front of a Member's tabs: asks for location when due (a new Member who didn't answer in
// setup's Area step, an existing one on the first open after #105), shows the area fallback once if refused, and
// sends the phone's location on each app open, at most every few hours. Foreground only.
export function LocationGate({ children }: { children: ReactNode }) {
  const userId = useSession().session!.user.id;
  const [step, setStep] = useState<Step>('loading');
  const [busy, setBusy] = useState(false);
  const record = useRef<PromptRecord | null>(null);
  const draft = useProfileDraft(userId);
  const areaName = useAreaName();

  const save = useCallback(
    (next: PromptRecord) => {
      record.current = next;
      return saveRecord(userId, next);
    },
    [userId],
  );

  const refresh = useCallback(async () => {
    const current = record.current;
    if (!current) {
      return;
    }
    try {
      const permission = await hasPermission();
      if (!shouldRefresh(current, permission, clock.now())) {
        return;
      }
      const { lat, lng } = await currentPosition();
      await setLocation(lat, lng);
      await save({
        ...record.current!,
        answer: 'allowed',
        sentAt: clock.now(),
      });
    } catch {
      // No fix, no network or refused by the server: the next app open tries again.
    }
  }, [save]);

  useEffect(() => {
    let live = true;
    (async () => {
      const saved = await loadRecord(userId);
      let permission: boolean | undefined;
      try {
        permission = await hasPermission();
      } catch {
        permission = undefined;
      }
      record.current = saved;
      if (!live) {
        return;
      }
      if (shouldPrompt(saved, permission, clock.now())) {
        setStep('prompt');
      } else {
        setStep('app');
        refresh();
      }
    })();
    return () => {
      live = false;
    };
  }, [userId, refresh]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refresh();
      }
    });
    return () => sub.remove();
  }, [refresh]);

  const refused = async (next: PromptRecord) => {
    await save(next.offShown ? next : { ...next, offShown: true });
    setStep(next.offShown ? 'app' : 'off');
  };

  const allow = async () => {
    setBusy(true);
    let granted = false;
    try {
      granted = await requestPermission();
    } catch {
      granted = false;
    }
    setBusy(false);
    const current = record.current!;
    if (granted) {
      await save({ ...current, answer: 'allowed' });
      setStep('app');
      refresh();
    } else {
      await refused({ ...current, answer: 'denied' });
    }
  };

  const notNow = () => {
    const current = record.current!;
    refused({
      ...current,
      answer: 'notNow',
      notNowCount: current.notNowCount + 1,
      notNowAt: clock.now(),
    });
  };

  if (step === 'loading') {
    return null;
  }
  if (step === 'prompt') {
    return <LocationScreen onAllow={allow} onNotNow={notNow} busy={busy} />;
  }
  if (step === 'off') {
    return (
      <LocationOffScreen
        area={areaName(draft.data?.areaId ?? null)}
        onOpenSettings={() => {
          Linking.openSettings();
          setStep('app');
        }}
        onContinue={() => setStep('app')}
      />
    );
  }
  return <>{children}</>;
}
