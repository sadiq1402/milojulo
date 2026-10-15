import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BrandLoader } from '../components/BrandLoader';
import { useAccountStage } from '../features/account/useAccountStage';
import { useSession } from '../features/auth/SessionProvider';
import { AgeConsentScreen } from '../screens/gettingIn/AgeConsentScreen';
import { EmailScreen } from '../screens/gettingIn/EmailScreen';
import { OtpScreen } from '../screens/gettingIn/OtpScreen';
import { ProfileSetupScreen } from '../screens/profileSetup/ProfileSetupScreen';
import { WelcomeScreen } from '../screens/gettingIn/WelcomeScreen';
import { LoadErrorScreen } from '../screens/StatusScreen';
import { MemberNavigator } from './MemberNavigator';
import type { SignedOutParams } from './types';

const SignedOut = createNativeStackNavigator<SignedOutParams>();
const Onboarding = createNativeStackNavigator();
// Signed out, then one onboarding step per account stage, then a Member's tabs.
// A completed step refreshes the stage, which swaps in the next screen.
// While the session or stage loads, the BrandLoader covers the app and fades out into the first screen.
export function RootNavigator() {
  const { session, loading } = useSession();
  const stage = useAccountStage();
  const booting = loading || (!!session && stage.isPending);
  const [loaderShown, setLoaderShown] = useState(booting);
  if (booting && !loaderShown) {
    setLoaderShown(true);
  }

  return (
    <View style={styles.fill}>
      {booting ? null : <Screens session={!!session} stage={stage} />}
      {loaderShown ? (
        <BrandLoader ready={!booting} onDone={() => setLoaderShown(false)} />
      ) : null}
    </View>
  );
}

function Screens({
  session,
  stage,
}: {
  session: boolean;
  stage: ReturnType<typeof useAccountStage>;
}) {
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

const styles = StyleSheet.create({ fill: { flex: 1 } });
