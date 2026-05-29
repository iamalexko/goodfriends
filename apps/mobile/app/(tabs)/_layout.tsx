import { Tabs } from 'expo-router'
import { View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

// Bottom tab bar — mirrors the web NavBar pattern with the centre "plan"
// tab presenting as a floating black pill instead of a flat icon.
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(255,251,245,0.95)',
          borderTopColor: 'rgba(0,0,0,0.06)',
          borderTopWidth: 1,
          height: 84,
          paddingBottom: 28,
          paddingTop: 10,
        },
        tabBarActiveTintColor: '#111111',
        tabBarInactiveTintColor: '#cccccc',
        tabBarLabelStyle: {
          fontSize: 9,
          fontFamily: 'Inter_600SemiBold',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'home',
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="crew"
        options={{
          title: 'crew',
          tabBarIcon: ({ color }) => <Ionicons name="people-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'plan',
          tabBarIcon: () => (
            <View
              style={{
                width: 50, height: 50, borderRadius: 25,
                backgroundColor: '#111', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <Ionicons name="add" size={24} color="#fff" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: 'plans',
          tabBarIcon: ({ color }) => <Ionicons name="calendar-outline" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'profile',
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={22} color={color} />,
        }}
      />
    </Tabs>
  )
}
