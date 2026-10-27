import { useQueryClient } from '@tanstack/react-query';
import React, {
  createContext,
  useCallback,
  useContext,
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
import { activityKeys } from '../activities/queries';
import { discoverKeys } from '../discover/queries';
import { setLocation } from './api';
import { currentPosition, hasPermission, requestPermission } from './device';
import {
  clock,
  loadRecord,
  locationAllowed,
  saveRecord,
  shouldPrompt,
  shouldRefresh,
  type PromptRecord,
} from './prompt';

type Step = 'loading' | 'prompt' | 'off' | 'app';

type TurnOn = { turnOn: () => Promise<void>; busy: boolean };
const TurnOnContext = createContext<TurnOn>({
  turnOn: async () => {},
  busy: false,
});

// For a screen that needs location (Discover, the Activity Board): asks for it, or opens the phone Settings once
// the phone's dialog was refused, then sends it.
export const useTurnOnLocation = () => useContext(TurnOnContext);

// In front of a Member's tabs: asks for location when due (a new Member right after setup, an
// existing one on the first open after #105), says once what refusing means, and sends the
// phone's location on each app open, at most every few hours. Foreground only.
export function LocationGate({ children }: { children: ReactNode }) {
  const userId = useSession().session!.user.id;
  const client = useQueryClient();
  const [step, setStep] = useState<Step>('loading');
  const [busy, setBusy] = useState(false);
  const [turningOn, setTurningOn] = useState(false);
  const record = useRef<PromptRecord | null>(null);

  const save = useCallback(
    (next: PromptRecord) => {
      record.current = next;
      return saveRecord(userId, next);
    },
    [userId],
  );

  // Discover and the Activity Board are empty without a fresh point, so they reload once one
  // is sent.
  const send = useCallback(async () => {
    const { lat, lng } = await currentPosition();
    await setLocation(lat, lng);
    await save({ ...record.current!, answer: 'allowed', sentAt: clock.now() });
    await Promise.all([
      client.invalidateQueries({ queryKey: discoverKeys.all }),
      client.invalidateQueries({ queryKey: activityKeys.all }),
    ]);
  }, [save, client]);

  const refresh = useCallback(async () => {
    const current = record.current;
    if (!current) {
      return;
    }
    try {
      const permission = await hasPermission();
      if (shouldRefresh(current, permission, clock.now())) {
        await send();
      }
    } catch {
      // No fix, no network or refused by the server: the next app open tries again.
    }
  }, [send]);

  const turnOn = useCallback(async () => {
    const current = record.current;
    if (!current) {
      return;
    }
    setTurningOn(true);
    try {
      let permission: boolean | undefined;
      try {
        permission = await hasPermission();
      } catch {
        permission = undefined;
      }
      if (!locationAllowed(current, permission)) {
        // The phone won't show its dialog again; coming back from Settings refreshes.
        if (current.answer === 'denied') {
          Linking.openSettings();
          return;
        }
        const granted = await requestPermission().catch(() => false);
        await save({ ...current, answer: granted ? 'allowed' : 'denied' });
        if (!granted) {
          return;
        }
      }
      await send();
    } catch {
      // No fix or no network: the button stays for another try.
    } finally {
      setTurningOn(false);
    }
  }, [save, send]);

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
    const granted = await requestPermission().catch(() => false);
    setBusy(false);
    const current = record.current!;
    if (granted) {
      await save({ ...current, answer: 'allowed' });
      setStep('app');
      // Just allowed, so sent now rather than on the next refresh.
      send().catch(() => {});
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
        onOpenSettings={() => {
          Linking.openSettings();
          setStep('app');
        }}
        onContinue={() => setStep('app')}
      />
    );
  }
  return (
    <TurnOnContext.Provider value={{ turnOn, busy: turningOn }}>
      {children}
    </TurnOnContext.Provider>
  );
}
