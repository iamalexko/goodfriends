// NativeWind v4 needs Metro to be aware of the global.css entry so it can
// generate the styles at compile time and ship them to RN at runtime.
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const config = getDefaultConfig(__dirname)

module.exports = withNativeWind(config, { input: './global.css' })
