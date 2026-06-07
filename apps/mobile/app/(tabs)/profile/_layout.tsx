import { Stack } from 'expo-router'

import { brandStackScreenOptions } from '../../../components/BrandHeader'

// Profile's native Stack header — shared transparent iOS 26 glass bar + brand row.
// See components/BrandHeader.tsx.
export default function ProfileStackLayout() {
  return <Stack screenOptions={brandStackScreenOptions} />
}
