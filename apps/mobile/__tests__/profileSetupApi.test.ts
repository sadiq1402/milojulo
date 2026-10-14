import { submitProfile } from '../src/features/profileSetup/api';
import {
  defaultAgeRange,
  firstIncompleteStep,
} from '../src/features/profileSetup/model';
import { supabase } from '../src/lib/supabase';
import { emptyDraft } from '../test/profileSetup';

const rpc = jest.fn();
(supabase as unknown as { rpc: jest.Mock }).rpc = rpc;

test.each([
  ['add your first name', 'Add your first name.', 'basics'],
  ['choose your area', 'Choose your area.', 'basics'],
  ['choose at least one mode', 'Choose at least one Mode.', 'modes'],
  [
    'add your gender',
    'Add your gender to use Dating, Serious or Casual.',
    'modes',
  ],
  [
    'set your dating preferences',
    "Choose who you'd like to meet, their age range and how far away.",
    'modes',
  ],
  ['answer 2 prompts', 'Answer both prompts.', 'prompts'],
  ['add at least 2 photos', 'Add at least 2 photos.', 'photos'],
  [
    'accept the terms first',
    'Accept the terms and give your date of birth first.',
    undefined,
  ],
  [
    'something else',
    "That didn't save. Check your connection and try again.",
    undefined,
  ],
])(
  'submit refused with "%s" reads "%s" and points at %s',
  async (message, copy, step) => {
    rpc.mockResolvedValue({ data: null, error: { message } });
    await expect(submitProfile()).rejects.toMatchObject({
      message: copy,
      step,
    });
    expect(rpc).toHaveBeenCalledWith('submit_profile');
  },
);

describe('resuming', () => {
  const basics = { ...emptyDraft, displayName: 'Asha', areaId: 'baner' };
  const prompts = [
    { position: 1 as const, questionId: 1, answer: 'One' },
    { position: 2 as const, questionId: 2, answer: 'Two' },
  ];

  test.each([
    ['a blank name', { ...basics, displayName: '  ' }, 2, 'basics'],
    ['one photo', basics, 1, 'photos'],
    [
      'one blank answer',
      { ...basics, prompts: [prompts[0], { ...prompts[1], answer: ' ' }] },
      2,
      'prompts',
    ],
    ['no Mode', { ...basics, prompts }, 2, 'modes'],
    [
      'a Dating Mode without preferences',
      {
        ...basics,
        prompts,
        modes: ['casual' as const],
        gender: 'man' as const,
      },
      2,
      'modes',
    ],
    [
      'everything required',
      { ...basics, prompts, modes: ['friends' as const] },
      2,
      'interests',
    ],
  ])('%s resumes at %s', (_, draft, photoCount, step) => {
    expect(firstIncompleteStep(draft, photoCount)).toBe(step);
  });
});

test('the starting age range is five years either side of my age, never under 18', () => {
  const today = new Date(2026, 9, 14);
  expect(defaultAgeRange('1996-10-15', today)).toEqual({ min: 24, max: 34 });
  expect(defaultAgeRange('1996-10-14', today)).toEqual({ min: 25, max: 35 });
  expect(defaultAgeRange('2007-01-01', today)).toEqual({ min: 18, max: 24 });
});
