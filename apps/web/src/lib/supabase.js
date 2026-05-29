// The shared package owns the Supabase client. Web reads it from there so
// the same instance flows through context, RPC helpers, etc.
export { supabase } from '@goodfriends/shared'
