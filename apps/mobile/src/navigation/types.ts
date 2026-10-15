import type { ReportTarget } from '../features/reports/api';

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
  // Posting from a Circle pre-selects it and shows its name.
  CreateActivity: { circleId: string; circleName: string } | undefined;
  EditActivity: { activityId: string };
  CircleDetail: { circleId: string };
  // memberId is whom "Also block" blocks: the owner, sender or host of what's reported.
  Report: {
    targetType: ReportTarget;
    targetId: string;
    memberId: string;
    memberName?: string;
  };
};
