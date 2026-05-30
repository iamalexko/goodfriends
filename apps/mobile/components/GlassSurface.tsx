import { ReactNode } from 'react'
import { StyleSheet, ViewStyle, StyleProp } from 'react-native'
import { BlurView } from 'expo-blur'
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect'

// One-time guard at module load — per Expo docs, some iOS 26 beta builds
// ship without the Liquid Glass API. Calling GlassView unconditionally
// would crash there. Evaluated once so we don't re-check on every render.
const LIQUID_GLASS = isLiquidGlassAvailable()

// Variant lets future surfaces opt into different materials. For now only
// 'chrome' exists (the standard system glass). Anything else (e.g. future
// 'sheet' / 'modal') falls back to BlurView so the option is non-binding.
export type GlassVariant = 'chrome'

// Real iOS 26 Liquid Glass when available, BlurView approximation otherwise.
// `interactive` toggles the GlassView's isInteractive flag — pressing/holding
// the surface causes the system material to subtly respond to touch.
export function GlassSurface({
  children,
  style,
  radius = 24,
  variant = 'chrome',
  interactive = false,
}: {
  children?: ReactNode
  style?: StyleProp<ViewStyle>
  radius?: number
  variant?: GlassVariant
  interactive?: boolean
}) {
  if (LIQUID_GLASS && variant === 'chrome') {
    return (
      <GlassView
        style={[{ borderRadius: radius, overflow: 'hidden' }, style]}
        glassEffectStyle="regular"
        isInteractive={interactive}
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
