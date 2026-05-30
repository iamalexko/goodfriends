import '../global.css'

import { useEffect } from 'react'
import { Stack } from 'expo-router'
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

import { AuthProvider } from '../context/AuthContext'

// Keep the splash up until fonts resolve so the wordmark doesn't flash in
// the system fallback face on first paint. If the font fetch errors out
// (e.g. flaky network), fall through to the app anyway — system fonts on
// the placeholder screens are an acceptable degradation.
SplashScreen.preventAutoHideAsync().catch(() => {})

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
