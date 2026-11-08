#!/usr/bin/env node
/**
 * Generates supabase/functions/_shared/generated-strength-standards.ts from
 * lib/exercise-standards-config.ts, so edge functions (Deno) and the shared
 * strength core use the same standards data as the app.
 *
 *   node scripts/generate-strength-standards.mjs          # write the file
 *   node scripts/generate-strength-standards.mjs --check  # exit 1 if stale
 *
 * Needs Node 22.18+ (imports the .ts config with built-in type stripping).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(
  root,
  'supabase/functions/_shared/generated-strength-standards.ts',
)

const {
  EXERCISES_WITH_STANDARDS,
  EXERCISE_MUSCLE_MAPPING,
  EXERCISE_TIER_WEIGHTS,
} = await import(pathToFileURL(resolve(root, 'lib/exercise-standards-config.ts')).href)

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/

function formatKey(key) {
  return IDENTIFIER.test(key) ? key : formatString(key)
}

function formatString(value) {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function format(value, depth = 0) {
  const indent = '  '.repeat(depth)
  const inner = '  '.repeat(depth + 1)

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    return `[\n${value.map((item) => inner + format(item, depth + 1)).join(',\n')}\n${indent}]`
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined)
    if (entries.length === 0) return '{}'
    return `{\n${entries
      .map(([key, item]) => `${inner}${formatKey(key)}: ${format(item, depth + 1)}`)
      .join(',\n')}\n${indent}}`
  }
  if (typeof value === 'string') return formatString(value)
  if (value === null) return 'null'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  throw new Error(`Cannot serialise ${typeof value}`)
}

const output = `/**
 * Generated from /lib/exercise-standards-config.ts
 * Do not edit manually; regenerate from the source config when standards change.
 */

export const GENERATED_EXERCISE_TIER_WEIGHTS = ${format(EXERCISE_TIER_WEIGHTS)} as const

export const GENERATED_EXERCISES_WITH_STANDARDS = ${format(EXERCISES_WITH_STANDARDS)} as const

export const GENERATED_EXERCISE_MUSCLE_MAPPING = ${format(EXERCISE_MUSCLE_MAPPING)} as const
`

if (process.argv.includes('--check')) {
  const current = readFileSync(outputPath, 'utf8')
  if (current !== output) {
    console.error(
      'generated-strength-standards.ts is out of date. Run: node scripts/generate-strength-standards.mjs',
    )
    process.exit(1)
  }
  console.log('generated-strength-standards.ts is up to date.')
} else {
  writeFileSync(outputPath, output)
  console.log(`Wrote ${outputPath}`)
}
