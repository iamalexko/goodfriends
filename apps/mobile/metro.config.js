// Workspace-aware Metro config for an Expo app inside an npm workspace.
//
// Without this, Metro only walks node_modules under apps/mobile and misses
// everything npm hoisted to the repo root (nativewind, framer-motion, etc).
// With it:
//   - watchFolders includes the workspace root so saving files in
//     packages/shared triggers a reload.
//   - nodeModulesPaths covers both the local and root node_modules so
//     hoisted deps still resolve.
//   - disableHierarchicalLookup forces Metro to use those paths verbatim
//     (which is what Expo's docs recommend in a monorepo).
//   - withNativeWind wires the global.css entry through Metro so Tailwind
//     classes get compiled into RN styles at build time.
const path = require('path')
const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
config.resolver.disableHierarchicalLookup = true

module.exports = withNativeWind(config, { input: './global.css' })
