const fs = require('fs')
const path = require('path')
const { withDangerousMod } = require('@expo/config-plugins')

module.exports = function withCustomLiveActivity(config) {
  return withDangerousMod(config, ['ios', async (cfg) => {
    const projectRoot = cfg.modRequest.projectRoot
    const iosLiveActivityPath = path.join(projectRoot, 'ios', 'LiveActivity')
    const sourceDir = path.join(projectRoot, 'plugins', 'live-activity')

    // Create directory if it doesn't exist
    if (!fs.existsSync(iosLiveActivityPath)) {
      console.log('[withCustomLiveActivity] Creating ios/LiveActivity directory')
      fs.mkdirSync(iosLiveActivityPath, { recursive: true })
    }

    // Copy base files from expo-live-activity first (so we get helpers like Color+hex, Image+dynamic, etc.)
    const expoLiveActivityFiles = path.join(projectRoot, 'node_modules', 'expo-live-activity', 'ios-files')
    if (fs.existsSync(expoLiveActivityFiles)) {
      const baseFiles = fs.readdirSync(expoLiveActivityFiles)
      for (const fileName of baseFiles) {
        const sourcePath = path.join(expoLiveActivityFiles, fileName)
        const targetPath = path.join(iosLiveActivityPath, fileName)
        const stat = fs.statSync(sourcePath)
        if (stat.isFile()) {
          fs.copyFileSync(sourcePath, targetPath)
          console.log(`[withCustomLiveActivity] Copied base: ${fileName}`)
        } else if (stat.isDirectory()) {
          // Copy directories recursively (like Assets.xcassets)
          copyDirSync(sourcePath, targetPath)
          console.log(`[withCustomLiveActivity] Copied dir: ${fileName}`)
        }
      }
    }

    // Now overlay our custom files (these override the expo-live-activity defaults)
    const customFiles = [
      'LiveActivityView.swift',
      'LiveActivityWidget.swift',
    ]

    for (const fileName of customFiles) {
      const sourcePath = path.join(sourceDir, fileName)
      const targetPath = path.join(iosLiveActivityPath, fileName)
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, targetPath)
        console.log(`[withCustomLiveActivity] Overlaid custom: ${fileName}`)
      } else {
        console.warn(`[withCustomLiveActivity] Custom file not found: ${sourcePath}`)
      }
    }

    return cfg
  }])
}

function copyDirSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }
  const entries = fs.readdirSync(src)
  for (const entry of entries) {
    const srcPath = path.join(src, entry)
    const destPath = path.join(dest, entry)
    const stat = fs.statSync(srcPath)
    if (stat.isDirectory()) {
      copyDirSync(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}
