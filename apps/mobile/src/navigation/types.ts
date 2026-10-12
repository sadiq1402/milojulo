export type SignedOutParams = {
  Welcome: undefined;
  InviteCode: undefined;
  Email: undefined;
  Otp: { email: string };
};

export type MemberParams = {
  Tabs: undefined;
  Chat: { connectionId: string };
  SafetyCentre: undefined;
};
