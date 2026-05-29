// Web-side Supabase client. Mobile has its own at apps/mobile/lib/supabase.ts
// that reads EXPO_PUBLIC_* env vars and uses SecureStore for sessions; this
// version reads Vite-injected VITE_* env vars and uses the default localStorage
// adapter. Keep these split — `import.meta.env` only exists in Vite and
// breaks Hermes parsers if shared.
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)
