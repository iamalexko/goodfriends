import { Text, View } from 'react-native'

// 3-up stat cell used on Profile. Same proportions as the web StatCell:
// big PJS-black number on top, tiny tracking-wide caps label underneath.
export function StatCell({
  value,
  label,
  color = '#111111',
}: {
  value: string | number
  label: string
  color?: string
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
      }}
    >
      <Text
        style={{
          fontFamily: 'PlusJakartaSans_800ExtraBold',
          fontSize: 22,
          fontWeight: '800',
          color,
          lineHeight: 24,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          fontFamily: 'Inter_600SemiBold',
          fontSize: 9,
          fontWeight: '600',
          color: '#BBBBBB',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          marginTop: 4,
        }}
      >
        {label}
      </Text>
    </View>
  )
}
