import { Platform } from 'react-native'
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

// expo-secure-store ships no web implementation — calling its async methods in
// a browser throws ".getValueWithKeyAsync is not a function". On native we
// stash auth tokens in the Keychain / EncryptedSharedPreferences (survives
// app restarts, isolated from other apps); on web we fall back to
// localStorage so the preview build still boots.
const webStorageAdapter = {
  getItem: async (key: string) => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(key)
  },
  setItem: async (key: string, value: string) => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(key, value)
  },
  removeItem: async (key: string) => {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(key)
  },
}

const nativeStorageAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

const storage = Platform.OS === 'web' ? webStorageAdapter : nativeStorageAdapter

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      // RN has no URL bar for magic-link callbacks; web doesn't use them either.
      detectSessionInUrl: false,
    },
  },
)
