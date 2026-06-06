// Push notifications — FULLY GUARDED until the APNs credential + aps-environment
// entitlement land (see HANDOFF "Push go-live checklist"). Until then:
//   • Simulator can't receive remote push at all.
//   • getExpoPushTokenAsync throws without the entitlement/credential (and
//     without an EAS projectId).
// So every call is wrapped — push code present, app never crashes, no token is
// stored, and a dev-only line prints so you can see it's wired.
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { supabase } from './supabase'

// Foreground display default: show a banner, no sound/badge. Guarded at module
// scope in case the native module isn't in the build.
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  })
} catch {}

// Do the real registration work AT MOST ONCE per user per app session. The
// caller effect can fire repeatedly (re-renders / auth events); this returns
// immediately after the first attempt so we never spam getExpoPushTokenAsync.
// Pass force=true to re-attempt (e.g. the device token changed).
let attemptedUserId: string | null = null

export async function registerPushToken(userId: string | undefined | null, force = false) {
  if (!userId) return
  if (!force && attemptedUserId === userId) return
  attemptedUserId = userId
  try {
    let status = (await Notifications.getPermissionsAsync()).status
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status
    if (status !== 'granted') {
      if (__DEV__) console.log('push: notification permission not granted')
      return
    }

    const projectId = (Constants.expoConfig as any)?.extra?.eas?.projectId
    const tokenResp = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
    const token = tokenResp?.data
    if (!token) {
      if (__DEV__) console.log('push token unavailable — credential pending')
      return
    }

    await supabase.from('push_tokens').upsert(
      { user_id: userId, token, platform: Platform.OS, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,token' },
    )
    if (__DEV__) console.log('push token registered')
  } catch (e) {
    if (__DEV__) console.log('push token unavailable — credential pending', e instanceof Error ? e.message : String(e))
  }
}

// Tap-to-route: a tapped push with data.plan_id opens that plan. Returns a
// cleanup fn. Guarded so a build without push doesn't break anything.
export function addPushResponseListener(onOpenPlan: (planId: string) => void): () => void {
  let sub: { remove: () => void } | null = null
  try {
    sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const planId = (response?.notification?.request?.content?.data as any)?.plan_id
      if (planId) onOpenPlan(String(planId))
    })
  } catch {}
  return () => {
    try {
      sub?.remove()
    } catch {}
  }
}
