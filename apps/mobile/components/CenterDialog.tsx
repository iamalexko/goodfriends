import { ReactNode, useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated'

// Confirmation dialog — the counterpart to the glass bottom-sheets. Where content
// sheets slide up + glass, confirmations FADE IN FROM THE CENTER + solid card, so
// motion & material encode present-vs-decide. Distinct from the abandoned
// animated-glass header: this animates a SOLID card's opacity/scale, never glass.
//
// - Enters fade (0→1) + scale (0.88→1), exits reverse, ~260/200ms ease-out.
// - Solid cream card (full contrast), darker scrim than content sheets (recede hard).
// - Backdrop tap = cancel only; it NEVER triggers the primary/destructive action.
// - `children` is an optional body slot (e.g. the close-event attendance checklist).
const EASE = Easing.bezier(0.2, 0.8, 0.2, 1)

export function CenterDialog({
  visible,
  onClose,
  icon,
  title,
  subtitle,
  children,
  primaryLabel,
  onPrimary,
  primaryDanger = false,
  primaryBusy = false,
  primaryBusyLabel,
  cancelLabel = 'Cancel',
}: {
  visible: boolean
  onClose: () => void
  icon?: ReactNode
  title: string
  subtitle?: string
  children?: ReactNode
  primaryLabel: string
  onPrimary: () => void
  primaryDanger?: boolean
  primaryBusy?: boolean
  primaryBusyLabel?: string
  cancelLabel?: string
}) {
  // Keep the Modal mounted through the exit animation, then unmount.
  const [mounted, setMounted] = useState(visible)
  const p = useSharedValue(0)

  useEffect(() => {
    if (visible) {
      setMounted(true)
      p.value = withTiming(1, { duration: 260, easing: EASE })
    } else if (mounted) {
      p.value = withTiming(0, { duration: 200, easing: EASE }, (fin) => {
        'worklet'
        if (fin) runOnJS(setMounted)(false)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const cardStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: interpolate(p.value, [0, 1], [0.88, 1]) }],
  }))
  const scrimStyle = useAnimatedStyle(() => ({ opacity: p.value }))

  if (!mounted) return null

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={onClose}>
      {/* Darker scrim than content sheets — the screen recedes hard. */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }, scrimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={primaryBusy ? undefined : onClose} />
      </Animated.View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }} pointerEvents="box-none">
        <Animated.View
          // Claim touches so taps on the card body don't fall through to the scrim.
          onStartShouldSetResponder={() => true}
          style={[
            {
              width: '100%',
              maxWidth: 440,
              backgroundColor: '#FFFBF5',
              borderRadius: 20,
              paddingHorizontal: 22,
              paddingTop: 22,
              paddingBottom: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 18 },
              shadowOpacity: 0.24,
              shadowRadius: 36,
            },
            cardStyle,
          ]}
        >
          {icon ? <View style={{ alignItems: 'center', marginBottom: 10 }}>{icon}</View> : null}
          <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 19, fontWeight: '800', color: '#111111', textAlign: 'center' }}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, lineHeight: 19, color: '#888888', textAlign: 'center', marginTop: 7 }}>
              {subtitle}
            </Text>
          ) : null}

          {children ? <View style={{ marginTop: 16 }}>{children}</View> : null}

          <Pressable
            onPress={onPrimary}
            disabled={primaryBusy}
            style={{
              marginTop: 18,
              borderRadius: 999,
              paddingVertical: 15,
              alignItems: 'center',
              backgroundColor: primaryDanger ? '#C0392B' : '#111111',
              opacity: primaryBusy ? 0.6 : 1,
            }}
          >
            <Text style={{ fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>
              {primaryBusy ? primaryBusyLabel || primaryLabel : primaryLabel}
            </Text>
          </Pressable>

          <Pressable onPress={onClose} disabled={primaryBusy} style={{ paddingVertical: 12, alignItems: 'center', marginTop: 2 }}>
            <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, fontWeight: '600', color: 'rgba(17,17,17,0.55)' }}>
              {cancelLabel}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  )
}
