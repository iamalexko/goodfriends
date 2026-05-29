// Public entry for @goodfriends/shared.
//
// Note: ./lib/supabase reads `import.meta.env.VITE_*`, which is Vite-specific.
// Only the web app consumes that file. The mobile app builds its own Supabase
// client at apps/mobile/lib/supabase.ts that reads `process.env.EXPO_PUBLIC_*`
// and uses SecureStore for session persistence. So mobile should NOT import
// from this barrel — it should reach into ./constants and ./utils/* directly.

export * from './lib/supabase.js'
export * from './constants.js'
export * from './utils/scoring.js'
export * from './utils/time.js'
