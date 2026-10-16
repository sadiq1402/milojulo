import { removeDeviceToken } from './api';
import { getToken } from './messaging';

// Called before signing out, while RLS still lets this Member delete their own token row.
export async function forgetThisDevice(): Promise<void> {
  try {
    const token = await getToken();
    if (token) {
      await removeDeviceToken(token);
    }
  } catch {
    // Signing out must never fail over this.
  }
}
