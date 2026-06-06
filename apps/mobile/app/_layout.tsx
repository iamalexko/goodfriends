import '../global.css'

import { useEffect, useRef } from 'react'
import { Stack, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import * as SplashScreen from 'expo-splash-screen'
// Plus Jakarta Sans tops out at 800 ExtraBold in @expo-google-fonts — no
// 900 Black variant exists. Importing PlusJakartaSans_900Black makes the
// whole useFonts call fail silently (undefined asset), which is why
// nothing PJS rendered until we dropped it.
import {
  useFonts,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans'
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_900Black,
} from '@expo-google-fonts/inter'

import { AuthProvider, useAuth } from '../context/AuthContext'
import { registerPushToken, addPushResponseListener } from '../lib/push'

// Keep the splash up until fonts resolve so the wordmark doesn't flash in
// the system fallback face on first paint. If the font fetch errors out
// (e.g. flaky network), fall through to the app anyway — system fonts on
// the placeholder screens are an acceptable degradation.
SplashScreen.preventAutoHideAsync().catch(() => {})

// Push wiring — lives inside AuthProvider so it can read the session. Registers
// the device token on login and routes plan-detail on a tapped push. Everything
// no-ops until the APNs credential lands (see lib/push.ts).
function PushBridge() {
  const { user } = useAuth()
  const router = useRouter()
  const routerRef = useRef(router)
  routerRef.current = router

  // Register once per logged-in user (the helper itself guards repeat calls).
  useEffect(() => {
    if (user?.id) registerPushToken(user.id)
  }, [user?.id])

  // Tap-to-route — set up once; route via a ref so router identity churn doesn't
  // re-create the listener.
  useEffect(() => {
    return addPushResponseListener((planId) => routerRef.current.push(`/plan/${planId}` as any))
  }, [])

  return null
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_900Black,
  })

  useEffect(() => {
    if (fontError) console.warn('useFonts error', fontError)
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {})
  }, [fontsLoaded, fontError])

  if (!fontsLoaded && !fontError) return null

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <PushBridge />
        <StatusBar style="dark" backgroundColor="#FFFBF5" />
        <Stack screenOptions={{ headerShown: false }}>
          {/* `create` lives outside the (tabs) group — opens as a modal sheet
              over whatever tab the user was on. */}
          <Stack.Screen
            name="create"
            options={{ presentation: 'modal', headerShown: false }}
          />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  )
}
