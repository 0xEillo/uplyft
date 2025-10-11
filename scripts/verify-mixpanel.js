'use strict'

const { spawnSync } = require('node:child_process')

function checkEnvVar(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`✖ Missing required env var: ${name}`)
    return false
  }
  console.log(`✔ ${name} set (length: ${value.length})`)
  return true
}

function checkExpoConfigToken() {
  const result = spawnSync('npx', ['expo', 'config', '--json'], {
    encoding: 'utf8',
  })
  if (result.error) {
    console.error('✖ Failed to read expo config', result.error)
    return false
  }
  try {
    const config = JSON.parse(result.stdout)
    const token = config.extra?.mixpanelToken
    if (!token || token === '${MIXPANEL_TOKEN}') {
      console.error('✖ mixpanelToken not resolved in expo config')
      return false
    }
    console.log('✔ mixpanelToken present in expo config')
    return true
  } catch (err) {
    console.error('✖ Unable to parse expo config JSON', err)
    return false
  }
}

function main() {
  const envOk = checkEnvVar('MIXPANEL_TOKEN')
  const configOk = checkExpoConfigToken()

  if (!envOk || !configOk) {
    process.exitCode = 1
  } else {
    console.log('Mixpanel configuration looks good!')
  }
}

main()
