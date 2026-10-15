import { act, fireEvent, screen } from '@testing-library/react-native';
import { NativeModules, Platform } from 'react-native';
import * as account from '../src/features/account/api';
import * as activities from '../src/features/activities/api';
import * as catalog from '../src/features/catalog/api';
import * as chat from '../src/features/chat/api';
import type { Conversation, Message } from '../src/features/chat/api';
import * as capture from '../src/features/chat/capture';
import * as media from '../src/features/chat/media';
import type { OutgoingMedia } from '../src/features/chat/media';
import { areas } from '../test/catalog';
import { renderApp, sessionFor } from '../test/render';

jest.mock('../src/features/account/api');
jest.mock('../src/features/auth/api');
jest.mock('../src/features/catalog/api');
jest.mock('../src/features/chat/api');
jest.mock('../src/features/activities/api');
jest.mock('../src/features/chat/capture', () => ({
  ...jest.requireActual('../src/features/chat/capture'),
  pickMedia: jest.fn(),
  startVoiceNote: jest.fn(),
}));
// Keep the real refusal copy; stand in only the calls.
jest.mock('../src/features/chat/media', () => ({
  ...jest.requireActual('../src/features/chat/media'),
  sendMediaMessage: jest.fn(),
  fetchMediaUrls: jest.fn(),
  fetchMediaState: jest.fn(),
  setMediaConsent: jest.fn(),
}));

const me = sessionFor('asha@example.com');

const isha: Conversation = {
  connectionId: 'conn-isha',
  otherId: 'isha',
  otherName: 'Isha',
  otherPhotoId: null,
  otherAreaId: 'baner',
  mode: 'friends',
  status: 'accepted',
  direction: 'incoming',
  note: null,
  lastMessage: {
    type: 'text',
    body: 'Hey!',
    at: '2026-10-12T10:00:00.000Z',
  },
  unreadCount: 0,
};

const message = (overrides: Partial<Message>): Message => ({
  id: 'm1',
  connectionId: 'conn-isha',
  senderId: 'isha',
  type: 'text',
  body: 'Hey!',
  activityId: null,
  createdAt: '2026-10-12T10:00:00.000Z',
  media: null,
  ...overrides,
});
const photoMessage = message({
  id: 'img-1',
  type: 'image',
  body: null,
  media: {
    mime: 'image/jpeg',
    width: 1200,
    height: 900,
    durationMs: null,
    expired: false,
  },
});
const expiredVideo = message({
  id: 'vid-old',
  type: 'video',
  body: null,
  createdAt: '2026-07-01T10:00:00.000Z',
  media: {
    mime: 'video/mp4',
    width: 1280,
    height: 720,
    durationMs: 12_000,
    expired: true,
  },
});
const voiceMessage = message({
  id: 'voice-1',
  type: 'voice',
  body: null,
  createdAt: '2026-10-12T10:05:00.000Z',
  media: {
    mime: 'audio/mp4',
    width: null,
    height: null,
    durationMs: 14_000,
    expired: false,
  },
});

const picked: OutgoingMedia = {
  kind: 'image',
  uri: 'file:///tmp/a.jpg',
  mime: 'image/jpeg',
  width: 1600,
  height: 1200,
  durationMs: null,
};

beforeEach(() => {
  jest.mocked(account.fetchAccountStage).mockResolvedValue('member');
  jest.mocked(activities.fetchMyJoinRequests).mockResolvedValue([]);
  jest.mocked(catalog.fetchAreas).mockResolvedValue(areas({ baner: 'Baner' }));
  jest.mocked(chat.fetchConversations).mockResolvedValue([isha]);
  jest
    .mocked(chat.fetchMessages)
    .mockResolvedValue([expiredVideo, photoMessage, voiceMessage]);
  jest
    .mocked(chat.fetchChatState)
    .mockResolvedValue({ otherLastReadAt: null, muted: false });
  jest.mocked(chat.markRead).mockResolvedValue();
  jest.mocked(chat.subscribeToChat).mockReturnValue(() => {});
  jest.mocked(chat.fetchOpenModeChange).mockResolvedValue(null);
  jest.mocked(chat.fetchEligibleModes).mockResolvedValue(['friends']);
  let n = 0;
  jest.mocked(chat.newMessageId).mockImplementation(() => `new-${++n}`);
  jest.mocked(media.fetchMediaUrls).mockResolvedValue({
    'img-1': 'https://r2/img-1',
    'voice-1': 'https://r2/voice-1',
  });
  jest
    .mocked(media.fetchMediaState)
    .mockResolvedValue({ isCasual: false, mine: false, theirs: false });
});

async function openChat() {
  const app = await renderApp(me);
  await fireEvent.press(await screen.findByRole('tab', { name: /^Inbox/ }));
  await fireEvent.press(screen.getByRole('tab', { name: 'Chats' }));
  await fireEvent.press(await screen.findByRole('button', { name: /^Isha/ }));
  await screen.findByText('Baner');
  return app;
}

describe('media in a chat', () => {
  test('shows photos from one batch of signed links, voice notes with their length, and expired media', async () => {
    await openChat();
    const photo = await screen.findByLabelText('Photo');
    expect(photo.props.source).toEqual({ uri: 'https://r2/img-1' });
    expect(
      screen.getByRole('button', { name: 'Play voice message, 0:14' }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Media expired')).toBeOnTheScreen();
    // Expired media is never asked for.
    expect(media.fetchMediaUrls).toHaveBeenCalledTimes(1);
    expect(media.fetchMediaUrls).toHaveBeenCalledWith(['img-1', 'voice-1']);
  });

  test('media the link service leaves out says it is unavailable', async () => {
    jest.mocked(media.fetchMediaUrls).mockResolvedValue({});
    await openChat();
    expect(await screen.findAllByText('Media unavailable')).toHaveLength(2);
  });

  test('a photo from the gallery shows at once and is sent with a phone-made id', async () => {
    jest.mocked(capture.pickMedia).mockResolvedValue(picked);
    let finish: () => void = () => {};
    jest
      .mocked(media.sendMediaMessage)
      .mockReturnValue(new Promise<void>(resolve => (finish = resolve)));
    await openChat();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Attach photo or video' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Choose from gallery' }),
    );
    expect(capture.pickMedia).toHaveBeenCalledWith('library');
    expect(media.sendMediaMessage).toHaveBeenCalledWith({
      id: 'new-1',
      connectionId: 'conn-isha',
      media: picked,
    });
    // The phone's copy shows while it uploads.
    expect(
      screen.getAllByLabelText('Photo').map(photo => photo.props.source.uri),
    ).toContain('file:///tmp/a.jpg');
    expect(screen.getByText('Sending…')).toBeOnTheScreen();
    await act(async () => finish());
  });

  test('a refused upload says why and can be retried with the same id', async () => {
    jest.mocked(capture.pickMedia).mockResolvedValue(picked);
    jest
      .mocked(media.sendMediaMessage)
      .mockRejectedValueOnce(
        new Error('That photo is too large to send. Try another one.'),
      )
      .mockResolvedValue();
    await openChat();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Attach photo or video' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Take a photo' }));
    expect(capture.pickMedia).toHaveBeenCalledWith('camera-photo');
    expect(
      await screen.findByText(
        'That photo is too large to send. Try another one.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: /Not sent\. Tap to retry/ }),
    );
    expect(media.sendMediaMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: 'new-1' }),
    );
  });

  test('a picker problem shows its reason and sends nothing', async () => {
    jest
      .mocked(capture.pickMedia)
      .mockRejectedValue(new Error('Videos can be up to 30 seconds.'));
    await openChat();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Attach photo or video' }),
    );
    await fireEvent.press(
      screen.getByRole('button', { name: 'Record a video' }),
    );
    expect(
      await screen.findByText('Videos can be up to 30 seconds.'),
    ).toBeOnTheScreen();
    expect(media.sendMediaMessage).not.toHaveBeenCalled();
  });

  test('holding the mic records a voice note and letting go sends it', async () => {
    const note: OutgoingMedia = {
      kind: 'voice',
      uri: 'file:///cache/v.m4a',
      mime: 'audio/mp4',
      width: null,
      height: null,
      durationMs: 5_000,
    };
    const stop = jest.fn().mockResolvedValue(note);
    jest.mocked(capture.startVoiceNote).mockResolvedValue({ stop });
    jest.mocked(media.sendMediaMessage).mockResolvedValue();
    await openChat();
    const mic = screen.getByRole('button', {
      name: 'Hold to record a voice note',
    });
    await fireEvent(mic, 'pressIn');
    expect(
      await screen.findByText(/Recording.*release to send/),
    ).toBeOnTheScreen();
    await fireEvent(mic, 'pressOut');
    expect(stop).toHaveBeenCalled();
    expect(media.sendMediaMessage).toHaveBeenCalledWith({
      id: 'new-1',
      connectionId: 'conn-isha',
      media: note,
    });
  });

  test('a voice note too short to keep sends nothing', async () => {
    jest
      .mocked(capture.startVoiceNote)
      .mockResolvedValue({ stop: jest.fn().mockResolvedValue(null) });
    await openChat();
    const mic = screen.getByRole('button', {
      name: 'Hold to record a voice note',
    });
    await fireEvent(mic, 'pressIn');
    await fireEvent(mic, 'pressOut');
    expect(media.sendMediaMessage).not.toHaveBeenCalled();
  });
});

describe('Media Consent in a Casual Connection', () => {
  beforeEach(() => {
    jest
      .mocked(chat.fetchConversations)
      .mockResolvedValue([{ ...isha, mode: 'casual' }]);
  });

  test('photo and video stay off until both switch it on, with an explanation', async () => {
    jest
      .mocked(media.fetchMediaState)
      .mockResolvedValue({ isCasual: true, mine: true, theirs: false });
    await openChat();
    expect(
      await screen.findByText(/Waiting for Isha to allow photos and video too/),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Attach photo or video' }),
    ).toBeDisabled();
  });

  test('while it is off, photos already sent are withheld but voice notes still play', async () => {
    jest
      .mocked(media.fetchMediaState)
      .mockResolvedValue({ isCasual: true, mine: false, theirs: true });
    jest
      .mocked(media.fetchMediaUrls)
      .mockResolvedValue({ 'voice-1': 'https://r2/voice-1' });
    await openChat();
    expect(
      await screen.findByText('Media is off in this chat'),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Play voice message, 0:14' }),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Media unavailable')).not.toBeOnTheScreen();
  });

  test('switching it on from the menu sets my side', async () => {
    jest
      .mocked(media.fetchMediaState)
      .mockResolvedValue({ isCasual: true, mine: false, theirs: true });
    jest.mocked(media.setMediaConsent).mockResolvedValue();
    await openChat();
    expect(
      await screen.findByText(/Switch on photos and video in the menu/),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText('Chat menu'));
    const toggle = screen.getByRole('switch', {
      name: 'Allow photos and video',
    });
    expect(toggle).not.toBeChecked();
    await fireEvent.press(toggle);
    expect(media.setMediaConsent).toHaveBeenCalledWith('conn-isha', true);
  });

  test('with both on, photo and video can be sent', async () => {
    jest
      .mocked(media.fetchMediaState)
      .mockResolvedValue({ isCasual: true, mine: true, theirs: true });
    await openChat();
    await screen.findByLabelText('Photo');
    expect(
      screen.getByRole('button', { name: 'Attach photo or video' }),
    ).toBeEnabled();
    expect(screen.queryByText(/Waiting for Isha/)).not.toBeOnTheScreen();
  });

  test('outside Casual there is no switch', async () => {
    jest.mocked(chat.fetchConversations).mockResolvedValue([isha]);
    await openChat();
    await fireEvent.press(screen.getByLabelText('Chat menu'));
    expect(
      screen.queryByRole('switch', { name: 'Allow photos and video' }),
    ).not.toBeOnTheScreen();
  });
});

describe('secure screen', () => {
  const os = Platform.OS;
  afterEach(() => {
    Platform.OS = os;
    delete NativeModules.SecureScreen;
  });

  test('on Android the chat blocks screenshots while open', async () => {
    Platform.OS = 'android';
    const setSecure = jest.fn();
    NativeModules.SecureScreen = { setSecure };
    await openChat();
    expect(setSecure).toHaveBeenLastCalledWith(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(setSecure).toHaveBeenLastCalledWith(false);
  });

  test('on iOS nothing is claimed or called', async () => {
    Platform.OS = 'ios';
    const setSecure = jest.fn();
    NativeModules.SecureScreen = { setSecure };
    await openChat();
    expect(setSecure).not.toHaveBeenCalled();
    expect(screen.queryByText(/screenshot/i)).toBeNull();
  });
});
