import { Stack } from 'expo-router'

import { brandStackScreenOptions } from '../../../components/BrandHeader'

// Plans' native Stack header — shared transparent iOS 26 glass bar + brand row.
// See components/BrandHeader.tsx.
export default function PlansStackLayout() {
  return <Stack screenOptions={brandStackScreenOptions} />
}
