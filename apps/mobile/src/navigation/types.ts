export type SignedOutParams = {
  Welcome: undefined;
  Email: undefined;
  Otp: { email: string };
};

export type MemberParams = {
  Tabs: undefined;
  Chat: { connectionId: string };
  Profile: { memberId: string };
  SafetyCentre: undefined;
  ActivityDetail: { activityId: string };
  CreateActivity: undefined;
  EditActivity: { activityId: string };
};
