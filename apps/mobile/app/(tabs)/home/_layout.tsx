import { Stack } from 'expo-router'

import { brandStackScreenOptions } from '../../../components/BrandHeader'

// Home's native Stack header — transparent iOS 26 glass bar carrying our shared
// brand row (wordmark + black-glass "+ Plan" + glass bell). All config lives in
// components/BrandHeader.tsx (brandStackScreenOptions), shared with the other
// tabs. Content insets under the bar via contentInsetAdjustmentBehavior in
// index.tsx — no scroll animation. Glass renders on a real iOS 26 device only.
export default function HomeStackLayout() {
  return <Stack screenOptions={brandStackScreenOptions} />
}
