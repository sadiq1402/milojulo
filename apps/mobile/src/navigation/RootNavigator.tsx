import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useAccountStage } from '../features/account/useAccountStage';
import { useSession } from '../features/auth/SessionProvider';
import { AgeConsentScreen } from '../screens/gettingIn/AgeConsentScreen';
import { EmailScreen } from '../screens/gettingIn/EmailScreen';
import { OtpScreen } from '../screens/gettingIn/OtpScreen';
import { ProfileSetupScreen } from '../screens/profileSetup/ProfileSetupScreen';
import { WelcomeScreen } from '../screens/gettingIn/WelcomeScreen';
import { LoadErrorScreen, LoadingScreen } from '../screens/StatusScreen';
import { MemberNavigator } from './MemberNavigator';
import type { SignedOutParams } from './types';

const SignedOut = createNativeStackNavigator<SignedOutParams>();
const Onboarding = createNativeStackNavigator();
// Signed out, then one onboarding step per account stage, then a Member's tabs.
// A completed step refreshes the stage, which swaps in the next screen.
export function RootNavigator() {
  const { session, loading } = useSession();
  const stage = useAccountStage();

  if (loading || (session && stage.isPending)) {
    return <LoadingScreen />;
  }
  if (!session) {
    return (
      <SignedOut.Navigator screenOptions={{ headerShown: false }}>
        <SignedOut.Screen name="Welcome" component={WelcomeScreen} />
        <SignedOut.Screen name="Email" component={EmailScreen} />
        <SignedOut.Screen name="Otp" component={OtpScreen} />
      </SignedOut.Navigator>
    );
  }
  if (stage.isError) {
    return <LoadErrorScreen onRetry={() => stage.refetch()} />;
  }
  if (stage.data === 'member') {
    return <MemberNavigator />;
  }
  return (
    <Onboarding.Navigator screenOptions={{ headerShown: false }}>
      {stage.data === 'consent' ? (
        <Onboarding.Screen name="AgeConsent" component={AgeConsentScreen} />
      ) : (
        <Onboarding.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      )}
    </Onboarding.Navigator>
  );
}
