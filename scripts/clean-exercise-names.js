require('dotenv').config()
const fs = require('fs')
const path = require('path')

function titleCase(str) {
  if (!str) return str

  // Handle special cases first
  const specialCases = {
    DB: 'DB',
    EZ: 'EZ',
    TRX: 'TRX',
  }

  // Capitalize every word - split by spaces and hyphens
  return str
    .split(/\s+/)
    .map((word) => {
      // Handle hyphenated words - capitalize each part
      if (word.includes('-')) {
        return word
          .split('-')
          .map((part) => {
            // Handle parentheses in parts
            if (part.includes('(')) {
              return part
                .replace(/\(([^)]+)\)/g, (match, content) => {
                  const capContent =
                    content.charAt(0).toUpperCase() +
                    content.slice(1).toLowerCase()
                  return '(' + capContent + ')'
                })
                .replace(/^([^(]+)/, (match) => {
                  return (
                    match.charAt(0).toUpperCase() + match.slice(1).toLowerCase()
                  )
                })
            }
            // Capitalize the part
            return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
          })
          .join('-')
      }

      // Handle parentheses
      if (word.includes('(')) {
        return word
          .replace(/\(([^)]+)\)/g, (match, content) => {
            const capContent =
              content.charAt(0).toUpperCase() + content.slice(1).toLowerCase()
            return '(' + capContent + ')'
          })
          .replace(/^([^(]+)/, (match) => {
            return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase()
          })
      }

      // Handle slashes
      if (word.includes('/')) {
        return word
          .split('/')
          .map((w) => {
            const trimmed = w.trim()
            return (
              trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
            )
          })
          .join('/')
      }

      // Regular word - capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
    .trim()
}

const exercisesPath = path.join(__dirname, '..', 'assets', 'exercises', 'exercises.json')
const data = JSON.parse(fs.readFileSync(exercisesPath, 'utf8'))

const cleaned = data.map((ex) => ({
  ...ex,
  name: titleCase(ex.name),
}))

fs.writeFileSync(exercisesPath, JSON.stringify(cleaned, null, 2))
console.log(`✅ Cleaned ${cleaned.length} exercise names`)

