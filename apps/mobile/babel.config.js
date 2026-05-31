// NativeWind v4 + Reanimated.
//   - jsxImportSource: routes `className` props through NativeWind's runtime
//   - `nativewind/babel` is the compiler that turns Tailwind classes into styles
//   - Reanimated 4 uses the WORKLETS plugin (react-native-worklets/plugin),
//     NOT the old react-native-reanimated/plugin. With the old one, worklets
//     (useAnimatedScrollHandler / useAnimatedStyle) silently no-op — which is
//     why scroll-driven animations did nothing. Must be last.
module.exports = function (api) {
  api.cache(true)
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: ['react-native-worklets/plugin'],
  }
}
