import { Modal, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { EMOJIS } from '@goodfriends/shared'

// Bottom-sheet emoji picker used on Profile (and reusable from anywhere
// else that needs to swap an emoji). Mirrors the web Profile's picker:
// 8-col grid, current selection highlighted with the amber chip + orange
// border + slight scale.
export function EmojiPicker({
  visible,
  currentEmoji,
  saving,
  onPick,
  onClose,
}: {
  visible: boolean
  currentEmoji?: string | null
  saving?: boolean
  onPick: (emoji: string) => void
  onClose: () => void
}) {
  const insets = useSafeAreaInsets()

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => !saving && onClose()}
    >
      <Pressable
        onPress={() => !saving && onClose()}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          // Inner stops the backdrop tap from dismissing the sheet.
          onPress={(e) => e.stopPropagation?.()}
          style={{
            backgroundColor: '#FFFBF5',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: Math.max(24, insets.bottom + 12),
          }}
        >
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: 'rgba(0,0,0,0.1)',
              alignSelf: 'center',
              marginBottom: 16,
            }}
          />

          <Text
            style={{
              fontFamily: 'PlusJakartaSans_800ExtraBold',
              fontSize: 18,
              fontWeight: '800',
              color: '#111111',
              marginBottom: 4,
            }}
          >
            Pick your emoji
          </Text>
          <Text
            style={{
              fontFamily: 'Inter_500Medium',
              fontSize: 12,
              color: '#AAAAAA',
              marginBottom: 14,
            }}
          >
            This is how your crew will recognise you.
          </Text>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 12,
            }}
          >
            {EMOJIS.map((e) => {
              const active = currentEmoji === e
              return (
                <Pressable
                  key={e}
                  onPress={() => !saving && onPick(e)}
                  disabled={saving}
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
                    opacity: saving ? 0.5 : 1,
                  }}
                >
                  <Text style={{ fontSize: 20 }}>{e}</Text>
                </Pressable>
              )
            })}
          </View>

          <Pressable
            onPress={() => !saving && onClose()}
            disabled={saving}
            style={{ paddingVertical: 12, alignItems: 'center' }}
          >
            <Text
              style={{
                fontFamily: 'Inter_600SemiBold',
                fontSize: 13,
                fontWeight: '600',
                color: 'rgba(17,17,17,0.6)',
              }}
            >
              {saving ? 'Saving…' : 'Cancel'}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
