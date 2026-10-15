import type { SetupStep } from '../features/profileSetup/model';
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
  Settings: undefined;
  BlockedPeople: undefined;
  ConsentSettings: undefined;
  DataCopy: undefined;
  // The consent step opens it too, without the pause alternative.
  DeleteAccount: { pauseInstead?: boolean } | undefined;
  // One profile setup step, opened from the Me tab.
  EditProfile: { section: SetupStep };
  ActivityDetail: { activityId: string };
  // Posting from a Circle pre-selects it and shows its name.
  CreateActivity: { circleId: string; circleName: string } | undefined;
  EditActivity: { activityId: string };
  CircleDetail: { circleId: string };
  // Without an Activity, the answer is about the pair's chat ("We met").
  MeetFeedback: {
    otherUserId: string;
    otherName: string;
    activityId?: string;
    activityTitle?: string;
    endsAt?: string;
  };
  // memberId is whom "Also block" blocks: the owner, sender or host of what's reported.
  Report: {
    targetType: ReportTarget;
    targetId: string;
    memberId: string;
    memberName?: string;
  };
};
