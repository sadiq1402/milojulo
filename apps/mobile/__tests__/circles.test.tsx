import { screen } from '@testing-library/react-native';
import * as account from '../src/features/account/api';
import * as activities from '../src/features/activities/api';
import * as catalog from '../src/features/catalog/api';
import * as chat from '../src/features/chat/api';
import * as discover from '../src/features/discover/api';
import { numbered } from '../test/catalog';
import { renderApp, sessionFor } from '../test/render';

jest.mock('../src/features/account/api');
jest.mock('../src/features/activities/api');
jest.mock('../src/features/auth/api');
jest.mock('../src/features/catalog/api');
jest.mock('../src/features/chat/api');
jest.mock('../src/features/circles/api');
jest.mock('../src/features/discover/api');
jest.mock('../src/features/location/api');

beforeEach(() => {
  jest.mocked(account.fetchAccountStage).mockResolvedValue('member');
  jest.mocked(catalog.fetchTags).mockResolvedValue(numbered({}));
  jest.mocked(catalog.fetchPromptQuestions).mockResolvedValue(numbered({}));
  jest.mocked(discover.fetchMyDiscoverState).mockResolvedValue({
    modes: ['friends'],
    paused: false,
    rangeKm: 10,
    hasLocation: true,
  });
  jest
    .mocked(discover.fetchFeedPage)
    .mockResolvedValue({ cards: [], nextCursor: null });
  jest.mocked(chat.fetchConversations).mockResolvedValue([]);
  jest.mocked(activities.fetchMyJoinRequests).mockResolvedValue([]);
});

// Circles is hidden for the beta (decision 72); its screens stay for when it comes back.
test('the tab bar has no Circles tab', async () => {
  await renderApp(sessionFor('asha@example.com'));
  expect(
    await screen.findByRole('tab', { name: 'Discover' }),
  ).toBeOnTheScreen();
  expect(screen.queryByRole('tab', { name: 'Circles' })).toBeNull();
});
