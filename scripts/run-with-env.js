#!/usr/bin/env node

/**
 * Lightweight helper to run a command with a specific dotenv file.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.test node scripts/run-with-env.js expo start
 */

const fs = require('node:fs')
const { spawn } = require('node:child_process')
const path = require('node:path')

const applyEnvFile = (filePath, override = false) => {
  const resolved = path.resolve(filePath)
  if (!fs.existsSync(resolved)) return
  const parsed = require('dotenv').parse(fs.readFileSync(resolved))
  for (const [key, value] of Object.entries(parsed)) {
    if (override || process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

const requestedEnv = process.env.DOTENV_CONFIG_PATH || '.env'

if (requestedEnv === '.env') {
  applyEnvFile('.env', true)
} else {
  applyEnvFile(requestedEnv, true)
  process.env.DOTENV_CONFIG_PATH = path.resolve(requestedEnv)
}

if (process.env.EXPO_PUBLIC_SUPABASE_URL) {
  console.log(
    '[run-with-env] EXPO_PUBLIC_SUPABASE_URL =',
    process.env.EXPO_PUBLIC_SUPABASE_URL,
  )
}

// Prevent Expo CLI from loading .env automatically (we already loaded the desired file)
process.env.EXPO_NO_DOTENV = '1'

const [, , ...cmd] = process.argv

if (cmd.length === 0) {
  console.error(
    'Usage: DOTENV_CONFIG_PATH=<path> node scripts/run-with-env.js <command> [args...]',
  )
  process.exit(1)
}

const child = spawn(cmd[0], cmd.slice(1), {
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
  } else {
    process.exit(code ?? 0)
  }
})
