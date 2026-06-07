import { Stack } from 'expo-router'

import { brandStackScreenOptions } from '../../../components/BrandHeader'

// Crew's native Stack header — shared transparent iOS 26 glass bar + brand row.
// See components/BrandHeader.tsx.
export default function CrewStackLayout() {
  return <Stack screenOptions={brandStackScreenOptions} />
}
