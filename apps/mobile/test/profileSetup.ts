import * as catalog from '../src/features/catalog/api';
import * as photos from '../src/features/photos/api';
import * as profileSetup from '../src/features/profileSetup/api';
import type { ProfileDraft } from '../src/features/profileSetup/model';
import { areas, numbered } from './catalog';

// A profile row right after the age gate and consents.
export const emptyDraft: ProfileDraft = {
  displayName: null,
  birthDate: '1998-03-21',
  prompts: [],
  modes: [],
  gender: null,
  prefGenders: [],
  prefAgeMin: null,
  prefAgeMax: null,
  prefMaxKm: null,
  profession: null,
  industryId: null,
  careerStage: null,
  tagIds: [],
  availability: [],
};

// For test files that jest.mock the profileSetup, photos and catalog data modules.
export function mockProfileSetup(
  draft: Partial<ProfileDraft> = {},
  myPhotos: photos.MyPhoto[] = [],
) {
  jest
    .mocked(profileSetup.fetchDraft)
    .mockResolvedValue({ ...emptyDraft, ...draft });
  jest.mocked(photos.fetchMyPhotos).mockResolvedValue(myPhotos);
  jest.mocked(photos.fetchPhotoUrls).mockResolvedValue({});
  jest
    .mocked(catalog.fetchAreas)
    .mockResolvedValue(areas({ baner: 'Baner', wakad: 'Wakad' }));
  jest.mocked(catalog.fetchPromptQuestions).mockResolvedValue(
    numbered({
      1: 'A perfect Sunday in Pune is…',
      2: "I'm looking for people to…",
    }),
  );
  jest
    .mocked(catalog.fetchTags)
    .mockResolvedValue(numbered({ 1: 'Badminton', 2: 'Cafes' }));
  jest
    .mocked(catalog.fetchIndustries)
    .mockResolvedValue(numbered({ 1: 'Software and IT' }));
}
