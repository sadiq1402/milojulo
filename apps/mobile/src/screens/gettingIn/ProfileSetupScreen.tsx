import React from 'react';
import { Button, FlowScreen } from '../../components';
import { signOut } from '../../features/auth/api';

// Placeholder until the profile setup screens (#38).
export function ProfileSetupScreen() {
  return (
    <FlowScreen
      title="Set up your profile"
      intro="Next come your first name, photos, prompts and Modes. This part of MiloJulo is still being built."
      footer={
        <Button
          label="Sign out"
          variant="secondary"
          onPress={() => signOut()}
        />
      }
    />
  );
}
