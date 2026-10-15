import { reportContent, reportReasons } from '../src/features/reports/api';
import { supabase } from '../src/lib/supabase';

// jest.setup.js stands Supabase in with an empty object; give it an rpc that answers like the
// database would, so the copy for each of its exact refusal messages is pinned here.
const rpc = jest.fn();
(supabase as unknown as { rpc: jest.Mock }).rpc = rpc;

const refuse = (message: string) =>
  rpc.mockResolvedValue({ data: null, error: { message } });

test('reports with the target, reason and trimmed details', async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  await reportContent({
    targetType: 'message',
    targetId: 'm1',
    reason: 'harassment',
    details: '  kept messaging after I said no ',
  });
  expect(rpc).toHaveBeenCalledWith('report', {
    target_type: 'message',
    target_id: 'm1',
    reason: 'harassment',
    details: 'kept messaging after I said no',
  });
});

test('blank details are left out', async () => {
  rpc.mockResolvedValue({ data: null, error: null });
  await reportContent({
    targetType: 'profile',
    targetId: 'p1',
    reason: 'other',
    details: '   ',
  });
  expect(rpc).toHaveBeenCalledWith('report', {
    target_type: 'profile',
    target_id: 'p1',
    reason: 'other',
  });
});

test('the reasons offered never include the word filter', () => {
  expect(reportReasons.map(r => r.reason)).toEqual([
    'fake_or_spam',
    'harassment',
    'inappropriate_content',
    'underage',
    'felt_unsafe',
    'other',
  ]);
});

test.each([
  ['sign in first', 'Sign in again to send a report.'],
  ['choose a reason', 'Choose a reason for your report.'],
  ['keep details to 500 characters', 'Keep the details to 500 characters.'],
  ['nothing to report', "This isn't available to report any more."],
  ['something else', "That didn't work. Check your connection and try again."],
])('refusal %p reads as friendly copy', async (message, copy) => {
  refuse(message);
  await expect(
    reportContent({ targetType: 'activity', targetId: 'a1', reason: 'other' }),
  ).rejects.toThrow(copy);
});
