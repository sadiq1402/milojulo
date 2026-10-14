// What the Circle screens share; kept apart from api.ts so tests can mock the calls alone.

// A Circle as the browse list and the detail both carry it: Area and interest (a tag),
// a member count, and whether I'm a Circle member (joined ones sort first).
export type Circle = {
  id: string;
  name: string;
  areaId: string;
  // The Circle's one interest; a tag id resolved to a label through the catalog.
  tagId: number;
  description: string | null;
  memberCount: number;
  iAmMember: boolean;
};

// A fellow Circle member, shown as a row that opens their profile.
export type CircleMember = {
  id: string;
  name: string;
  coverPhotoId: string | null;
  areaId: string | null;
};

export function memberCountLabel(count: number): string {
  return count === 1 ? '1 member' : `${count} members`;
}
