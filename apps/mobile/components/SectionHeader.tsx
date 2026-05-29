import { Pressable, Text, View } from 'react-native'

// All-caps tracking-wide label that introduces a group of cards/rows.
// Matches the web `<SectionHeader>` rhythm (mb-3 below).
export function SectionHeader({
  children,
  action,
  onAction,
}: {
  children: React.ReactNode
  action?: string
  onAction?: () => void
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 12,
      }}
    >
      <Text
        style={{
          fontFamily: 'Inter_700Bold',
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: '#BBBBBB',
        }}
      >
        {children}
      </Text>
      {action && (
        <Pressable onPress={onAction} hitSlop={6}>
          <Text
            style={{
              fontFamily: 'Inter_700Bold',
              fontSize: 10,
              fontWeight: '700',
              color: '#FB923C',
            }}
          >
            {action}
          </Text>
        </Pressable>
      )}
    </View>
  )
}
