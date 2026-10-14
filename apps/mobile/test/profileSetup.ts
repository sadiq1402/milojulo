import * as catalog from '../src/features/catalog/api';
import * as photos from '../src/features/photos/api';
import * as profileSetup from '../src/features/profileSetup/api';
import type { ProfileDraft } from '../src/features/profileSetup/model';

// A profile row right after the age gate and consents.
export const emptyDraft: ProfileDraft = {
  displayName: null,
  areaId: null,
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
  jest.mocked(catalog.fetchAreaList).mockResolvedValue([
    { id: 'baner', label: 'Baner' },
    { id: 'wakad', label: 'Wakad' },
  ]);
  jest.mocked(catalog.fetchPromptQuestionList).mockResolvedValue([
    { id: 1, label: 'A perfect Sunday in Pune is…' },
    { id: 2, label: "I'm looking for people to…" },
  ]);
  jest.mocked(catalog.fetchTagList).mockResolvedValue([
    { id: 1, label: 'Badminton' },
    { id: 2, label: 'Cafes' },
  ]);
  jest
    .mocked(catalog.fetchIndustryList)
    .mockResolvedValue([{ id: 1, label: 'Software and IT' }]);
}
