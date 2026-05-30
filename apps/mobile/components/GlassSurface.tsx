import { ReactNode } from 'react'
import { StyleSheet, ViewStyle, StyleProp } from 'react-native'
import { BlurView } from 'expo-blur'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'

// One-time guard at module load — per Expo docs, some iOS 26 beta builds
// ship without the Liquid Glass API. Calling GlassView unconditionally
// would crash there. Evaluated once so we don't re-check on every render.
const LIQUID_GLASS = isLiquidGlassAvailable()

// Real iOS 26 Liquid Glass when available, BlurView approximation otherwise.
// Single component so every surface that wants glass calls this and gets the
// right material automatically.
export function GlassSurface({
  children,
  style,
  radius = 34,
}: {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
  radius?: number
}) {
  if (LIQUID_GLASS) {
    return (
      <GlassView
        style={[{ borderRadius: radius, overflow: 'hidden' }, style]}
        glassEffectStyle="regular"
      >
        {children}
      </GlassView>
    )
  }

  return (
    <BlurView
      intensity={40}
      tint="light"
      style={[
        {
          borderRadius: radius,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.6)',
        },
        styles.fallbackShadow,
        style,
      ]}
    >
      {children}
    </BlurView>
  )
}

const styles = StyleSheet.create({
  fallbackShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
  },
})
