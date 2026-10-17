import { notifyManager } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { act } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import ImagePicker from 'react-native-image-crop-picker';
import * as account from '../src/features/account/api';
import * as activities from '../src/features/activities/api';
import * as chat from '../src/features/chat/api';
import * as discover from '../src/features/discover/api';
import * as location from '../src/features/location/api';
import * as device from '../src/features/location/device';
import { emptyRecord, saveRecord } from '../src/features/location/prompt';
import * as photos from '../src/features/photos/api';
import * as profileSetup from '../src/features/profileSetup/api';
import { SetupError } from '../src/features/profileSetup/model';
import * as catalog from '../src/features/catalog/api';
import { areas, numbered } from '../test/catalog';
import { mockProfileSetup } from '../test/profileSetup';
import { renderApp, sessionFor } from '../test/render';

jest.mock('../src/features/account/api');
jest.mock('../src/features/activities/api');
jest.mock('../src/features/auth/api');
jest.mock('../src/features/catalog/api');
jest.mock('../src/features/chat/api');
jest.mock('../src/features/discover/api');
jest.mock('../src/features/location/api');
jest.mock('../src/features/photos/api');
jest.mock('../src/features/profileSetup/api');

const userId = 'id-asha@example.com';
const twoPhotos = [
  { id: 'p1', position: 1 },
  { id: 'p2', position: 2 },
];
const basics = { displayName: 'Asha', areaId: 'baner' };
const prompts = [
  { position: 1 as const, questionId: 1, answer: 'Chai and a trek' },
  { position: 2 as const, questionId: 2, answer: 'Play badminton' },
];

// TanStack Query notifies on a 0 ms timer, which lands outside the act() of the press that
// started a save; a microtask settles inside it. Jest gives each test file its own modules.
beforeAll(() =>
  notifyManager.setScheduler(callback => Promise.resolve().then(callback)),
);

beforeEach(() => {
  jest.mocked(account.fetchAccountStage).mockResolvedValue('profile');
  jest.mocked(profileSetup.saveBasics).mockResolvedValue();
  jest.mocked(profileSetup.savePrompts).mockResolvedValue();
  jest.mocked(profileSetup.saveModes).mockResolvedValue();
  jest.mocked(profileSetup.saveInterests).mockResolvedValue();
  jest.mocked(location.setLocation).mockResolvedValue();
  jest.spyOn(device, 'hasPermission').mockResolvedValue(false);
  jest.spyOn(device, 'requestPermission').mockResolvedValue(false);
  jest.spyOn(device, 'currentPosition').mockRejectedValue(new Error('no fix'));
});

// What the Member's tabs load once setup is done.
function mockMemberTabs() {
  jest.mocked(account.fetchAccountStage).mockResolvedValue('member');
  jest.mocked(chat.fetchConversations).mockResolvedValue([]);
  jest.mocked(activities.fetchMyJoinRequests).mockResolvedValue([]);
  jest.mocked(discover.fetchMyDiscoverState).mockResolvedValue({
    modes: ['friends'],
    paused: false,
    rangeKm: 10,
    inServiceRegion: true,
  });
  jest
    .mocked(discover.fetchFeedPage)
    .mockResolvedValue({ cards: [], nextCursor: null });
}

async function open() {
  await renderApp(sessionFor('asha@example.com'));
}

const header = (name: string) => screen.findByRole('header', { name });
const button = (name: string) => screen.getByRole('button', { name });

describe('basics', () => {
  test('a new Member starts here; Next waits for a first name and an Area, then saves', async () => {
    mockProfileSetup();
    await open();
    expect(await header('What should we call you?')).toBeOnTheScreen();
    expect(screen.getByLabelText('Step 1 of 5')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'No one sees your location. Others see a rounded distance, like "~3 km".',
      ),
    ).toBeOnTheScreen();
    expect(button('Next')).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText('First name'), ' Asha ');
    expect(button('Next')).toBeDisabled();
    await fireEvent.press(button('Choose from the list'));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Wakad' }));
    await fireEvent.press(button('Next'));

    expect(await header('Add 2 to 4 photos')).toBeOnTheScreen();
    expect(screen.getByLabelText('Step 2 of 5')).toBeOnTheScreen();
    expect(profileSetup.saveBasics).toHaveBeenCalledWith(userId, {
      displayName: ' Asha ',
      areaId: 'wakad',
    });
  });

  test('a save that fails stays on the step with the reason', async () => {
    mockProfileSetup(basics);
    jest
      .mocked(profileSetup.saveBasics)
      .mockRejectedValue(new SetupError("That didn't save."));
    await open();
    await header('Add 2 to 4 photos');
    await fireEvent.press(button('Back'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Next' }));
    expect(await screen.findByText("That didn't save.")).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: 'What should we call you?' }),
    ).toBeOnTheScreen();
  });
});

describe('the Area step', () => {
  // Centres as in the catalog; the test phone sits in Aundh.
  const pune = areas(
    {
      aundh: 'Aundh',
      baner: 'Baner',
      kondhwa: 'Kondhwa',
      'koregaon-park': 'Koregaon Park',
      kothrud: 'Kothrud',
      'pimple-nilakh': 'Pimple Nilakh',
    },
    {
      aundh: { zone: 'central', lat: 18.558, lng: 73.808 },
      baner: { zone: 'west', lat: 18.559, lng: 73.786 },
      kondhwa: { zone: 'south', lat: 18.465, lng: 73.89 },
      'koregaon-park': { zone: 'central', lat: 18.536, lng: 73.894 },
      kothrud: { zone: 'central', lat: 18.507, lng: 73.808 },
      'pimple-nilakh': { zone: 'pimpri_chinchwad', lat: 18.58, lng: 73.808 },
    },
  );
  const inAundh = { lat: 18.556, lng: 73.807 };

  async function openAt(point: { lat: number; lng: number } | null) {
    mockProfileSetup({ displayName: 'Asha' });
    jest.mocked(catalog.fetchAreas).mockResolvedValue(pune);
    jest.spyOn(device, 'requestPermission').mockResolvedValue(!!point);
    if (point) {
      jest.spyOn(device, 'currentPosition').mockResolvedValue(point);
    }
    await open();
    await header('What should we call you?');
    await fireEvent.press(button('Use my location'));
  }

  test('the nearest Area within 3 km is chosen, and Next saves it', async () => {
    await openAt(inAundh);
    expect(await screen.findByText('Aundh')).toBeOnTheScreen();
    expect(screen.getByText("Looks like you're near here")).toBeOnTheScreen();
    expect(
      screen.queryByRole('header', { name: 'Choose your area' }),
    ).toBeNull();
    await fireEvent.press(button('Next'));
    await header('Add 2 to 4 photos');
    expect(profileSetup.saveBasics).toHaveBeenCalledWith(userId, {
      displayName: 'Asha',
      areaId: 'aundh',
    });
  });

  test('further than 3 km, the list opens with nothing chosen and the nearest on top', async () => {
    await openAt({ lat: 18.6, lng: 73.7 });
    expect(await header('Choose your area')).toBeOnTheScreen();
    expect(screen.queryByRole('radio', { checked: true })).toBeNull();
    expect(
      screen.getByRole('header', { name: 'Nearest to you' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('radio', { name: 'Baner, ~10 km' }),
    ).toBeOnTheScreen();
    expect(button('Next')).toBeDisabled();
  });

  test('a refused permission opens the list, and the location prompt is not shown again after setup', async () => {
    await openAt(null);
    expect(await header('Choose your area')).toBeOnTheScreen();
    expect(screen.queryByText('Nearest to you')).toBeNull();
    expect(screen.getByRole('header', { name: 'West' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Kothrud' }));
    expect(await screen.findByText('Kothrud')).toBeOnTheScreen();
    expect(screen.queryByText("Looks like you're near here")).toBeNull();
    expect(location.setLocation).not.toHaveBeenCalled();

    // Setup done: the Member's tabs open without asking for location again.
    await screen.unmount();
    mockMemberTabs();
    await open();
    expect(
      await screen.findByRole('tab', { name: 'Discover', selected: true }),
    ).toBeOnTheScreen();
    expect(screen.queryByText('See who’s nearby')).toBeNull();
  });

  test('"Change" overrides the suggestion', async () => {
    await openAt(inAundh);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Change' }),
    );
    expect(await header('Choose your area')).toBeOnTheScreen();
    expect(
      screen.getByRole('radio', { name: 'Aundh, <2 km', checked: true }),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'Kothrud' }));
    expect(await screen.findByText('Kothrud')).toBeOnTheScreen();
    expect(screen.queryByText("Looks like you're near here")).toBeNull();
    await fireEvent.press(button('Next'));
    await header('Add 2 to 4 photos');
    expect(profileSetup.saveBasics).toHaveBeenCalledWith(userId, {
      displayName: 'Asha',
      areaId: 'kothrud',
    });
  });

  test('searching filters by name, any case, with the zone and a hint', async () => {
    await openAt(null);
    await header('Choose your area');
    await fireEvent.changeText(screen.getByLabelText('Search areas'), 'KO');
    expect(
      screen.getAllByRole('radio').map(row => row.props.accessibilityLabel),
    ).toEqual(['Kondhwa, South', 'Koregaon Park, Central', 'Kothrud, Central']);
    expect(
      screen.getByText(
        'Not listed? Pick the closest area. More of Pune is coming.',
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: 'Central' })).toBeNull();
    // The matched letters are picked out in each name.
    expect(screen.getAllByText('Ko')).toHaveLength(3);
  });
});

describe('resuming', () => {
  test('a returning Member opens at the first step not yet done', async () => {
    mockProfileSetup(basics, twoPhotos);
    await open();
    expect(
      await header('Two lines that start a conversation'),
    ).toBeOnTheScreen();
  });

  test('going back shows what was saved', async () => {
    mockProfileSetup(basics, twoPhotos);
    await open();
    await header('Two lines that start a conversation');
    await fireEvent.press(button('Back'));
    await header('Add 2 to 4 photos');
    await fireEvent.press(button('Back'));
    await header('What should we call you?');
    expect(screen.getByLabelText('First name')).toHaveDisplayValue('Asha');
    expect(await screen.findByText('Baner')).toBeOnTheScreen();
    expect(button('Change')).toBeOnTheScreen();
  });

  test('a Dating Mode without its preferences reopens the Modes step', async () => {
    mockProfileSetup({ ...basics, prompts, modes: ['dating'] }, twoPhotos);
    await open();
    expect(await header('What are you open to?')).toBeOnTheScreen();
  });
});

describe('photos', () => {
  test('a photo is picked from the gallery, cropped to 4:5 and uploaded to the next slot', async () => {
    mockProfileSetup(basics, [{ id: 'p1', position: 1 }]);
    jest
      .mocked(ImagePicker.openPicker)
      .mockResolvedValue({ path: 'file:///tmp/new.jpg' } as never);
    jest.mocked(photos.uploadPhoto).mockImplementation(async () => {
      jest.mocked(photos.fetchMyPhotos).mockResolvedValue(twoPhotos);
      return 'p2';
    });
    await open();
    await header('Add 2 to 4 photos');
    expect(screen.getByText('Main photo')).toBeOnTheScreen();
    expect(screen.queryByText(/reviews every photo/)).toBeNull();
    expect(button('Next')).toBeDisabled();

    await fireEvent.press(
      screen.getAllByRole('button', { name: 'Add photo' })[0],
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Choose from your photos' }),
    );

    expect(
      await screen.findByRole('button', { name: 'Photo 2' }),
    ).toBeOnTheScreen();
    expect(ImagePicker.openPicker).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: 'photo',
        cropping: true,
        width: 1080,
        height: 1350,
        compressImageQuality: 0.8,
      }),
    );
    expect(photos.uploadPhoto).toHaveBeenCalledWith(2, 'file:///tmp/new.jpg');
    await waitFor(() => expect(button('Next')).toBeEnabled());
  });

  test('backing out of the camera uploads nothing', async () => {
    mockProfileSetup(basics);
    jest
      .mocked(ImagePicker.openCamera)
      .mockRejectedValue(
        Object.assign(new Error('cancelled'), { code: 'E_PICKER_CANCELLED' }),
      );
    await open();
    await header('Add 2 to 4 photos');
    await fireEvent.press(
      screen.getAllByRole('button', { name: 'Add photo' })[0],
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Take a photo' }),
    );
    await waitFor(() => expect(ImagePicker.openCamera).toHaveBeenCalled());
    expect(photos.uploadPhoto).not.toHaveBeenCalled();
  });

  test('a camera without permission says how to allow it', async () => {
    mockProfileSetup(basics);
    jest
      .mocked(ImagePicker.openCamera)
      .mockRejectedValue(
        Object.assign(new Error('denied'), { code: 'E_NO_CAMERA_PERMISSION' }),
      );
    await open();
    await header('Add 2 to 4 photos');
    await fireEvent.press(
      screen.getAllByRole('button', { name: 'Add photo' })[0],
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Take a photo' }),
    );
    expect(
      await screen.findByText(
        "Allow camera access for MiloJulo in your phone's settings, then try again.",
      ),
    ).toBeOnTheScreen();
  });

  test('a failed upload can be retried', async () => {
    mockProfileSetup(basics);
    jest
      .mocked(ImagePicker.openPicker)
      .mockResolvedValue({ path: 'file:///tmp/a.jpg' } as never);
    jest
      .mocked(photos.uploadPhoto)
      .mockRejectedValueOnce(
        new Error("The photo didn't finish uploading. Try again."),
      )
      .mockImplementation(async () => {
        jest
          .mocked(photos.fetchMyPhotos)
          .mockResolvedValue([{ id: 'p1', position: 1 }]);
        return 'p1';
      });
    await open();
    await header('Add 2 to 4 photos');
    await fireEvent.press(
      screen.getAllByRole('button', { name: 'Add photo' })[0],
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Choose from your photos' }),
    );
    expect(
      await screen.findByText("The photo didn't finish uploading. Try again."),
    ).toBeOnTheScreen();

    await fireEvent.press(button('Retry photo 1'));
    expect(
      await screen.findByRole('button', { name: 'Photo 1, main photo' }),
    ).toBeOnTheScreen();
    expect(photos.uploadPhoto).toHaveBeenLastCalledWith(1, 'file:///tmp/a.jpg');
  });

  test('a photo can become the main photo, be replaced or be removed', async () => {
    mockProfileSetup(basics, twoPhotos);
    jest.mocked(photos.movePhoto).mockResolvedValue();
    jest.mocked(photos.deletePhoto).mockResolvedValue();
    jest
      .mocked(ImagePicker.openPicker)
      .mockResolvedValue({ path: 'file:///tmp/b.jpg' } as never);
    jest.mocked(photos.uploadPhoto).mockResolvedValue('p3');
    await open();
    await header('Two lines that start a conversation');
    await fireEvent.press(button('Back'));

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Photo 2' }),
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Make main photo' }),
    );
    expect(photos.movePhoto).toHaveBeenCalledWith('p2', 1);

    await fireEvent.press(button('Photo 2'));
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Replace photo' }),
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Choose from your photos' }),
    );
    await waitFor(() =>
      expect(photos.uploadPhoto).toHaveBeenCalledWith(2, 'file:///tmp/b.jpg'),
    );

    await fireEvent.press(button('Photo 2'));
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Remove photo' }),
    );
    expect(photos.deletePhoto).toHaveBeenCalledWith('p2');
  });

  test('a refused change shows why', async () => {
    mockProfileSetup(basics, twoPhotos);
    jest
      .mocked(photos.movePhoto)
      .mockRejectedValue(new Error('That photo is already gone.'));
    await open();
    await header('Two lines that start a conversation');
    await fireEvent.press(button('Back'));
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Photo 2' }),
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Make main photo' }),
    );
    expect(
      await screen.findByText('That photo is already gone.'),
    ).toBeOnTheScreen();
  });
});

describe('prompts', () => {
  test('two answers with a counter, saved with their questions', async () => {
    mockProfileSetup(basics, twoPhotos);
    await open();
    await header('Two lines that start a conversation');
    expect(screen.getAllByText('0 / 140')).toHaveLength(2);
    await fireEvent.changeText(
      await screen.findByLabelText('A perfect Sunday in Pune is…'),
      'Chai and a trek',
    );
    expect(screen.getByText('15 / 140')).toBeOnTheScreen();
    expect(button('Next')).toBeDisabled();
    await fireEvent.changeText(
      screen.getByLabelText("I'm looking for people to…"),
      'Play badminton',
    );
    await fireEvent.press(button('Next'));
    expect(await header('What are you open to?')).toBeOnTheScreen();
    expect(profileSetup.savePrompts).toHaveBeenCalledWith(userId, prompts);
  });
});

describe('Modes', () => {
  async function openModes() {
    mockProfileSetup({ ...basics, prompts }, twoPhotos);
    await open();
    await header('What are you open to?');
  }

  test('Friends alone needs nothing more', async () => {
    await openModes();
    expect(button('Next')).toBeDisabled();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Friends' }));
    expect(
      screen.queryByRole('header', { name: 'For Dating, Serious and Casual' }),
    ).toBeNull();
    await fireEvent.press(button('Next'));
    expect(await header('What do you enjoy?')).toBeOnTheScreen();
    expect(profileSetup.saveModes).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ modes: ['friends'], gender: null }),
    );
  });

  test('Casual is labelled for adults', async () => {
    await openModes();
    expect(screen.getByText('18+ · adults only')).toBeOnTheScreen();
  });

  test('a Dating Mode asks for gender and Dating Preferences', async () => {
    await openModes();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Serious' }));
    expect(
      screen.getByRole('header', { name: 'For Dating, Serious and Casual' }),
    ).toBeOnTheScreen();
    // Five years either side of a 1998-03-21 birthday, 15 km.
    expect(screen.getByLabelText(/^Youngest: \d+$/)).toBeOnTheScreen();
    expect(screen.getByLabelText('How far away: 15 km')).toBeOnTheScreen();
    expect(button('Next')).toBeDisabled();

    await fireEvent.press(button('Woman'));
    expect(button('Next')).toBeDisabled();
    await fireEvent.press(button('Men'));
    await fireEvent.press(button('Further'));
    await fireEvent.press(button('Next'));

    await header('What do you enjoy?');
    expect(profileSetup.saveModes).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        modes: ['serious'],
        gender: 'woman',
        prefGenders: ['man'],
        prefMaxKm: 20,
      }),
    );
    const saved = jest.mocked(profileSetup.saveModes).mock.calls[0][1];
    expect(saved.prefAgeMax! - saved.prefAgeMin!).toBe(10);
  });

  test('Networking offers optional profession, Industry and Career Stage', async () => {
    await openModes();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Networking' }));
    expect(button('Next')).toBeEnabled();
    await fireEvent.changeText(
      screen.getByLabelText('Profession'),
      'Product designer',
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Software and IT' }),
    );
    await fireEvent.press(button('Mid career'));
    await fireEvent.press(button('Next'));
    await header('What do you enjoy?');
    expect(profileSetup.saveModes).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({
        modes: ['networking'],
        profession: 'Product designer',
        industryId: 1,
        careerStage: 'mid',
      }),
    );
  });
});

describe('interests and submit', () => {
  const complete = { ...basics, prompts, modes: ['friends' as const] };

  test('submitting saves interests and availability, then lands on Discover', async () => {
    mockProfileSetup(complete, twoPhotos);
    jest.spyOn(device, 'hasPermission').mockResolvedValue(true);
    jest.mocked(chat.fetchConversations).mockResolvedValue([]);
    jest.mocked(activities.fetchMyJoinRequests).mockResolvedValue([]);
    jest.mocked(discover.fetchMyDiscoverState).mockResolvedValue({
      modes: ['friends'],
      paused: false,
      rangeKm: 10,
      inServiceRegion: true,
    });
    jest
      .mocked(discover.fetchFeedPage)
      .mockResolvedValue({ cards: [], nextCursor: null });
    jest.mocked(profileSetup.submitProfile).mockImplementation(async () => {
      jest.mocked(account.fetchAccountStage).mockResolvedValue('member');
    });
    await open();
    await header('What do you enjoy?');
    expect(screen.getByLabelText('Step 5 of 5')).toBeOnTheScreen();
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Badminton' }),
    );
    await fireEvent.press(button('Weekends'));
    await fireEvent.press(button('Finish and submit'));

    expect(
      await screen.findByRole('tab', { name: 'Discover', selected: true }),
    ).toBeOnTheScreen();
    expect(profileSetup.saveInterests).toHaveBeenCalledWith(userId, {
      tagIds: [1],
      availability: ['weekends'],
    });
    expect(profileSetup.submitProfile).toHaveBeenCalled();
  });

  test('with location allowed in setup, submitting sends it before the first feed loads', async () => {
    mockProfileSetup(complete, twoPhotos);
    await saveRecord(userId, { ...emptyRecord, answer: 'allowed' });
    jest.spyOn(device, 'hasPermission').mockResolvedValue(true);
    jest
      .spyOn(device, 'currentPosition')
      .mockResolvedValue({ lat: 18.556, lng: 73.807 });
    jest.mocked(profileSetup.submitProfile).mockImplementation(async () => {
      mockMemberTabs();
    });
    await open();
    await header('What do you enjoy?');
    await fireEvent.press(button('Finish and submit'));

    expect(
      await screen.findByRole('tab', { name: 'Discover', selected: true }),
    ).toBeOnTheScreen();
    await waitFor(() => expect(discover.fetchFeedPage).toHaveBeenCalled());
    expect(location.setLocation).toHaveBeenCalledTimes(1);
    expect(location.setLocation).toHaveBeenCalledWith(18.556, 73.807);
    expect(
      jest.mocked(location.setLocation).mock.invocationCallOrder[0],
    ).toBeLessThan(
      jest.mocked(discover.fetchFeedPage).mock.invocationCallOrder[0],
    );
  });

  test('a refusal opens the step that fixes it, with the reason', async () => {
    mockProfileSetup(complete, twoPhotos);
    jest
      .mocked(profileSetup.submitProfile)
      .mockRejectedValue(new SetupError('Add at least 2 photos.', 'photos'));
    await open();
    await header('What do you enjoy?');
    await fireEvent.press(button('Finish and submit'));
    expect(await header('Add 2 to 4 photos')).toBeOnTheScreen();
    expect(screen.getByText('Add at least 2 photos.')).toBeOnTheScreen();
  });

  test('a refusal without a step stays here', async () => {
    mockProfileSetup(complete, twoPhotos);
    jest
      .mocked(profileSetup.submitProfile)
      .mockRejectedValue(new SetupError("That didn't save."));
    await open();
    await header('What do you enjoy?');
    await fireEvent.press(button('Finish and submit'));
    expect(await screen.findByText("That didn't save.")).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: 'What do you enjoy?' }),
    ).toBeOnTheScreen();
  });
});

// Android's hardware back button, as the setup screen subscribed to it.
let backSpy: jest.SpyInstance | undefined;
afterEach(() => backSpy?.mockRestore());

function captureHardwareBack() {
  let handler: () => boolean | null | undefined = () => false;
  backSpy = jest.spyOn(BackHandler, 'addEventListener');
  backSpy.mockImplementation((_, h) => {
    handler = h as typeof handler;
    return { remove: () => {} };
  });
  return () => act(async () => void handler());
}

describe('leaving a step', () => {
  test('Back saves what was typed, so coming back shows it', async () => {
    mockProfileSetup(basics, twoPhotos);
    await open();
    await header('Two lines that start a conversation');
    await fireEvent.changeText(
      await screen.findByLabelText('A perfect Sunday in Pune is…'),
      'Chai and a trek',
    );
    await fireEvent.press(button('Back'));
    expect(await header('Add 2 to 4 photos')).toBeOnTheScreen();
    // Blank answers aren't saved: an empty prompt would count toward the minimum.
    expect(profileSetup.savePrompts).toHaveBeenCalledWith(userId, [prompts[0]]);
    await fireEvent.press(button('Next'));
    expect(
      await screen.findByLabelText('A perfect Sunday in Pune is…'),
    ).toHaveDisplayValue('Chai and a trek');
  });

  test("Android's back button saves the same way, even when the step isn't finished", async () => {
    const pressBack = captureHardwareBack();
    mockProfileSetup({ ...basics, prompts }, twoPhotos);
    await open();
    await header('What are you open to?');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Serious' }));
    await pressBack();
    expect(
      await header('Two lines that start a conversation'),
    ).toBeOnTheScreen();
    expect(profileSetup.saveModes).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ modes: ['serious'], gender: null }),
    );
  });

  test('a save that fails on the way back stays on the step with the reason', async () => {
    mockProfileSetup({ ...basics, prompts, modes: ['friends'] }, twoPhotos);
    jest
      .mocked(profileSetup.saveInterests)
      .mockRejectedValue(new SetupError("That didn't save."));
    await open();
    await header('What do you enjoy?');
    await fireEvent.press(button('Back'));
    expect(await screen.findByText("That didn't save.")).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: 'What do you enjoy?' }),
    ).toBeOnTheScreen();
  });

  test('while a photo uploads, leaving and changing photos wait', async () => {
    const pressBack = captureHardwareBack();
    mockProfileSetup(basics, twoPhotos);
    jest
      .mocked(ImagePicker.openPicker)
      .mockResolvedValue({ path: 'file:///tmp/c.jpg' } as never);
    let finish: (id: string) => void = () => {};
    jest.mocked(photos.uploadPhoto).mockImplementation(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    await open();
    await header('Two lines that start a conversation');
    await fireEvent.press(button('Back'));
    await header('Add 2 to 4 photos');
    await fireEvent.press(
      screen.getAllByRole('button', { name: 'Add photo' })[0],
    );
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Choose from your photos' }),
    );
    expect(await screen.findByText('Uploading…')).toBeOnTheScreen();

    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
    expect(button('Next')).toBeDisabled();
    expect(button('Photo 2')).toBeDisabled();
    await pressBack();
    expect(
      screen.getByText('Wait for the photo to finish uploading.'),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: 'Add 2 to 4 photos' }),
    ).toBeOnTheScreen();

    jest
      .mocked(photos.fetchMyPhotos)
      .mockResolvedValue([...twoPhotos, { id: 'p3', position: 3 }]);
    await act(async () => finish('p3'));
    await waitFor(() => expect(button('Next')).toBeEnabled());
    expect(button('Photo 2')).toBeEnabled();
  });
});

describe('edge cases', () => {
  test('prompts wait when the catalog has fewer than two questions', async () => {
    mockProfileSetup(basics, twoPhotos);
    jest
      .mocked(catalog.fetchPromptQuestions)
      .mockResolvedValue(numbered({ 1: 'A perfect Sunday in Pune is…' }));
    await open();
    await header('Two lines that start a conversation');
    expect(
      await screen.findByText(
        "Prompts aren't available right now. Try again later.",
      ),
    ).toBeOnTheScreen();
    expect(button('Next')).toBeDisabled();
  });

  test('a submit refusal shown on a step clears once the Member changes something there', async () => {
    mockProfileSetup({ ...basics, prompts, modes: ['friends'] }, twoPhotos);
    jest
      .mocked(profileSetup.submitProfile)
      .mockRejectedValue(new SetupError('Answer both prompts.', 'prompts'));
    await open();
    await header('What do you enjoy?');
    await fireEvent.press(button('Finish and submit'));
    await header('Two lines that start a conversation');
    expect(screen.getByText('Answer both prompts.')).toBeOnTheScreen();
    await fireEvent.changeText(
      screen.getByLabelText("I'm looking for people to…"),
      'Play cricket',
    );
    expect(screen.queryByText('Answer both prompts.')).toBeNull();
  });
});
