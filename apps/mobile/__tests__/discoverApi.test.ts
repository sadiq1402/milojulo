import { fetchFeedPage } from '../src/features/discover/api';
import { supabase } from '../src/lib/supabase';

// jest.setup.js stands Supabase in with an empty object; give it an rpc that answers like the database would.
const rpc = jest.fn();
(supabase as unknown as { rpc: jest.Mock }).rpc = rpc;

const row = (id: string) => ({
  user_id: id,
  display_name: 'Asha',
  age: 27,
  area_id: 'baner',
  modes: ['friends'],
  their_modes: ['friends'],
  distance_band: '<2 km',
  cover_photo_id: null,
  shared_tag_ids: [],
  why_you_match: 'You both want friends.',
  cursor: `c-${id}`,
});

test('the feed sends every picked Mode and keeps each card the database returns', async () => {
  rpc.mockResolvedValue({ data: [row('a'), row('b')], error: null });
  const page = await fetchFeedPage({
    modes: ['activities', 'networking'],
    pageSize: 2,
  });
  expect(rpc).toHaveBeenCalledWith('discover_feed', {
    mode_filter: ['activities', 'networking'],
    page_size: 2,
    after: undefined,
  });
  expect(page.cards.map(c => c.id)).toEqual(['a', 'b']);
  expect(page.nextCursor).toBe('c-b');
});
