import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

// Compact group identity chip — shown in the Home greeting row. Taps route
// to the Crew tab. Visually: a row of up to 4 overlapping emoji faces, the
// group name, a 1px divider, a green-dot attendance %, and a chevron.
export function CrewPill({
  groupName,
  memberEmojis = [],
  avgAttendance,
  onPress,
}: {
  groupName: string
  memberEmojis?: string[]
  avgAttendance?: number | null
  onPress?: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      // Static style — function form drops props on iOS RN in this SDK.
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(255,255,255,0.72)',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.06)',
        borderRadius: 999,
        paddingVertical: 5,
        paddingLeft: 6,
        paddingRight: 10,
        flexShrink: 0,
      }}
    >
      {/* Overlapping emoji faces */}
      <View style={{ flexDirection: 'row' }}>
        {memberEmojis.slice(0, 4).map((emoji, i) => (
          <View
            key={`${emoji}-${i}`}
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: '#F0F0F0',
              borderWidth: 1.5,
              borderColor: '#FFFBF5',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: -5,
              // zIndex doesn't reorder RN siblings reliably, but later faces
              // sit beneath earlier ones in the source — the `marginRight: -5`
              // achieves the overlap visually regardless.
            }}
          >
            <Text style={{ fontSize: 11 }}>{emoji}</Text>
          </View>
        ))}
      </View>

      <Text
        style={{
          fontFamily: 'Inter_600SemiBold',
          fontSize: 10,
          fontWeight: '600',
          color: '#555555',
          marginLeft: 7,
        }}
        numberOfLines={1}
      >
        {groupName}
      </Text>

      <View
        style={{
          width: 1,
          height: 12,
          backgroundColor: 'rgba(0,0,0,0.1)',
          marginHorizontal: 2,
        }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <View
          style={{
            width: 5,
            height: 5,
            borderRadius: 2.5,
            backgroundColor: '#34D399',
          }}
        />
        <Text
          style={{
            fontFamily: 'Inter_700Bold',
            fontSize: 10,
            fontWeight: '700',
            color: '#34D399',
          }}
        >
          {avgAttendance ? `${avgAttendance}%` : '—'}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={10} color="#DDDDDD" />
    </Pressable>
  )
}
