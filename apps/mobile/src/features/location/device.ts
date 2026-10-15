import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';

export type Coords = { lat: number; lng: number };

// Foreground only; the app asks for permission itself, never as a side effect of reading.
Geolocation.setRNConfiguration({
  skipPermissionRequests: true,
  authorizationLevel: 'whenInUse',
  enableBackgroundLocationUpdates: false,
});

// iOS has no read-only check here, so it reports undefined and the saved answer decides.
export async function hasPermission(): Promise<boolean | undefined> {
  if (Platform.OS !== 'android') {
    return undefined;
  }
  // Android 12+ lets people grant approximate only, which is enough for distance bands.
  return PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  );
}

export async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);
    return Object.values(result).includes(PermissionsAndroid.RESULTS.GRANTED);
  }
  return new Promise(resolve =>
    Geolocation.requestAuthorization(
      () => resolve(true),
      () => resolve(false),
    ),
  );
}

export function currentPosition(): Promise<Coords> {
  return new Promise((resolve, reject) =>
    Geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      reject,
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
    ),
  );
}
