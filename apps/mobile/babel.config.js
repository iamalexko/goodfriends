// NativeWind v4 + Reanimated.
//   - jsxImportSource: routes `className` props through NativeWind's runtime
//   - `nativewind/babel` is the compiler that turns Tailwind classes into styles
//   - react-native-reanimated/plugin must be last per Reanimated docs
module.exports = function (api) {
  api.cache(true)
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: ['react-native-reanimated/plugin'],
  }
}
