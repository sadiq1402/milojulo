import { createNavigationContainerRef } from '@react-navigation/native';
import type { MemberParams } from './types';

// For navigating from outside a screen, such as a tapped push notification.
export const navigationRef = createNavigationContainerRef<MemberParams>();
