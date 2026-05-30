import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { EMOJIS } from '@goodfriends/shared'

import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Single screen with a Login/SignUp toggle, matching the web Auth flow.
// Profile name + emoji are captured inline on signup so there's no
// separate onboarding step — the auth gate just routes to /auth.

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  return mode === 'login' ? (
    <Login onSwitch={() => setMode('signup')} />
  ) : (
    <SignUp onSwitch={() => setMode('login')} />
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={{ flex: 1, backgroundColor: '#FFFBF5' }}>
      <View style={{ paddingTop: Math.max(24, insets.top + 8), paddingHorizontal: 28 }}>
        <Text
          style={{
            fontFamily: 'PlusJakartaSans_800ExtraBold',
            fontSize: 14,
            fontWeight: '800',
            color: '#111111',
            letterSpacing: -0.3,
          }}
        >
          Goodfriends.
        </Text>
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <View style={{ flex: 1, paddingHorizontal: 28, paddingTop: 16, paddingBottom: Math.max(20, insets.bottom + 12) }}>
          {children}
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const labelStyle = {
  fontFamily: 'Inter_700Bold',
  fontSize: 10,
  fontWeight: '700' as const,
  letterSpacing: 1.2,
  textTransform: 'uppercase' as const,
  color: '#AAAAAA',
  marginBottom: 6,
}

const inputStyle = {
  width: '100%' as const,
  paddingHorizontal: 16,
  paddingVertical: 16,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: 'rgba(0,0,0,0.1)',
  backgroundColor: 'rgba(255,255,255,0.8)',
  color: '#111111',
  fontFamily: 'Inter_500Medium',
  fontSize: 15,
  marginBottom: 12,
}

const primaryButtonStyle = {
  paddingVertical: 16,
  borderRadius: 999,
  backgroundColor: '#111111',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
}

const primaryButtonText = {
  color: '#FFFFFF',
  fontFamily: 'PlusJakartaSans_800ExtraBold',
  fontSize: 16,
  fontWeight: '900' as const,
}

function Login({ onSwitch }: { onSwitch: () => void }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    setError('')
    if (!email.trim()) {
      setError('Enter your email')
      return
    }
    if (!password) {
      setError('Enter your password')
      return
    }
    setLoading(true)
    const trimmed = email.trim().toLowerCase()
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: trimmed, password })
    setLoading(false)
    if (signInErr) {
      setError(signInErr.message)
      return
    }
    // The auth gate at app/index.tsx only re-evaluates on `/`, not while we
    // sit on `/auth`. Explicitly route to the tabs after a successful sign-in.
    router.replace('/(tabs)/home' as any)
  }

  return (
    <Shell>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between' }} keyboardShouldPersistTaps="handled">
        <View>
          <Text
            style={{
              fontFamily: 'PlusJakartaSans_800ExtraBold',
              fontSize: 36,
              fontWeight: '900',
              color: '#111111',
              letterSpacing: -1,
              lineHeight: 38,
              marginBottom: 8,
            }}
          >
            Welcome back.
          </Text>
          <Text style={{ color: '#888888', fontSize: 14, marginBottom: 32, fontFamily: 'Inter_400Regular' }}>
            Sign in to keep the streak going.
          </Text>

          <Text style={labelStyle}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#BBBBBB"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            style={inputStyle}
          />

          <Text style={labelStyle}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Your password"
            placeholderTextColor="#BBBBBB"
            secureTextEntry
            autoCapitalize="none"
            textContentType="password"
            style={inputStyle}
          />

          {error ? <Text style={{ color: '#DC2626', fontSize: 12, marginTop: 4 }}>{error}</Text> : null}
        </View>

        <View style={{ paddingTop: 16 }}>
          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={[primaryButtonStyle, loading && { opacity: 0.5 }]}
          >
            <Text style={primaryButtonText}>{loading ? 'Signing in…' : 'Sign in →'}</Text>
          </Pressable>
          <Pressable onPress={onSwitch} style={{ paddingVertical: 12, alignItems: 'center' }} hitSlop={8}>
            <Text style={{ color: '#888888', fontSize: 13, fontFamily: 'Inter_500Medium' }}>
              Don't have an account?{' '}
              <Text style={{ color: '#111111', fontWeight: '700', fontFamily: 'Inter_700Bold' }}>Sign up</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Shell>
  )
}

function SignUp({ onSwitch }: { onSwitch: () => void }) {
  const router = useRouter()
  const { fetchProfile } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    setError('')
    if (!email.trim()) {
      setError('Enter an email')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (!name.trim()) {
      setError('Enter a display name')
      return
    }
    if (!emoji) {
      setError('Pick an emoji')
      return
    }
    setLoading(true)
    const trimmed = email.trim().toLowerCase()
    const signUp = await supabase.auth.signUp({ email: trimmed, password })
    if (signUp.error) {
      const msg = signUp.error.message || ''
      setError(/registered|exists/i.test(msg) ? 'That email is already registered. Try logging in.' : msg)
      setLoading(false)
      return
    }
    // If email confirmation is on, signUp returns no session — try to sign in.
    let userId = signUp.data.user?.id
    if (!signUp.data.session) {
      const signIn = await supabase.auth.signInWithPassword({ email: trimmed, password })
      if (signIn.error) {
        setError(signIn.error.message)
        setLoading(false)
        return
      }
      userId = signIn.data.user?.id || userId
    }
    if (!userId) {
      setError('Could not create account')
      setLoading(false)
      return
    }
    const { error: profErr } = await supabase
      .from('profiles')
      .upsert({ id: userId, display_name: name.trim(), emoji })
    if (profErr) {
      setError(profErr.message)
      setLoading(false)
      return
    }
    await fetchProfile?.(userId)
    setLoading(false)
    router.replace('/(tabs)/home' as any)
  }

  return (
    <Shell>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <Text
          style={{
            fontFamily: 'PlusJakartaSans_800ExtraBold',
            fontSize: 32,
            fontWeight: '900',
            color: '#111111',
            letterSpacing: -1,
            lineHeight: 34,
            marginBottom: 8,
          }}
        >
          Show up.{'\n'}Be remembered.
        </Text>
        <Text style={{ color: '#888888', fontSize: 14, marginBottom: 20, fontFamily: 'Inter_400Regular' }}>
          Create your account and pick your vibe.
        </Text>

        <Text style={labelStyle}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="#BBBBBB"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          style={inputStyle}
        />

        <Text style={labelStyle}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="At least 6 characters"
          placeholderTextColor="#BBBBBB"
          secureTextEntry
          autoCapitalize="none"
          textContentType="newPassword"
          style={inputStyle}
        />

        <Text style={labelStyle}>Display name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Alex Ko"
          placeholderTextColor="#BBBBBB"
          autoCapitalize="words"
          style={inputStyle}
        />

        <Text style={[labelStyle, { marginBottom: 8 }]}>Pick your vibe</Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 8,
          }}
        >
          {EMOJIS.map((e) => {
            const active = emoji === e
            return (
              <Pressable
                key={e}
                onPress={() => setEmoji(e)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? '#FEF3C7' : '#F3F4F6',
                  borderWidth: active ? 2 : 0,
                  borderColor: active ? '#FB923C' : 'transparent',
                  transform: [{ scale: active ? 1.1 : 1 }],
                }}
              >
                <Text style={{ fontSize: 20 }}>{e}</Text>
              </Pressable>
            )
          })}
        </View>
        {emoji ? (
          <Text style={{ textAlign: 'center', fontSize: 40, marginVertical: 4 }}>{emoji}</Text>
        ) : null}

        {error ? <Text style={{ color: '#DC2626', fontSize: 12, marginTop: 4 }}>{error}</Text> : null}

        <View style={{ paddingTop: 16 }}>
          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={[primaryButtonStyle, loading && { opacity: 0.5 }]}
          >
            <Text style={primaryButtonText}>{loading ? 'Creating account…' : 'Create account →'}</Text>
          </Pressable>
          <Pressable onPress={onSwitch} style={{ paddingVertical: 12, alignItems: 'center' }} hitSlop={8}>
            <Text style={{ color: '#888888', fontSize: 13, fontFamily: 'Inter_500Medium' }}>
              Already have an account?{' '}
              <Text style={{ color: '#111111', fontWeight: '700', fontFamily: 'Inter_700Bold' }}>Log in</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Shell>
  )
}
