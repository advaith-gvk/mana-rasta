// src/utils/device.ts
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Generate and persist a device fingerprint.
 * Uses Expo Application ID + Device model + a random UUID persisted in SecureStore.
 */
export async function registerDeviceFingerprint(): Promise<{
  fingerprint: string;
  model: string;
  platform: string;
}> {
  let fingerprint = await SecureStore.getItemAsync('device_fingerprint');

  if (!fingerprint) {
    const appId  = Application.applicationId || 'unknown';
    const instId = await Application.getIosIdForVendorAsync?.() || Application.androidId || 'unknown';
    const random = Math.random().toString(36).substring(2, 10);
    fingerprint  = `${appId}-${instId}-${random}`.substring(0, 255);
    await SecureStore.setItemAsync('device_fingerprint', fingerprint);
  }

  return {
    fingerprint,
    model:    `${Device.brand} ${Device.modelName}`,
    platform: Platform.OS,
  };
}

/**
 * Request push notification permissions and return the FCM/APNs token.
 * Call after successful login.
 */
export async function registerPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications not available in simulator');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  // Get the Expo push token (wraps FCM on Android, APNs on iOS)
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
  });

  // Configure notification behaviour
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge:  true,
    }),
  });

  return tokenData.data;
}

/**
 * Update notification channels for Android.
 */
export async function configureNotificationChannels() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('status_updates', {
    name:       'Status updates',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#f97316',
  });

  await Notifications.setNotificationChannelAsync('rewards', {
    name:       'Rewards & badges',
    importance: Notifications.AndroidImportance.DEFAULT,
  });

  await Notifications.setNotificationChannelAsync('sla', {
    name:       'SLA alerts',
    importance: Notifications.AndroidImportance.MAX,
  });
}
