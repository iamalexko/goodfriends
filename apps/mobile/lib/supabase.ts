import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

// SecureStore on iOS/Android keeps the auth session in the Keychain /
// EncryptedSharedPreferences so it survives app restarts without being
// readable by other apps. Supabase calls this adapter on every session
// read/write — it has to satisfy the synchronous-ish KV shape it expects.
const ExpoSecureStoreAdapter = {
  getItem:    (key: string) => SecureStore.getItemAsync(key),
  setItem:    (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      // RN has no URL bar for magic-link callbacks to flow through.
      detectSessionInUrl: false,
    },
  },
)
