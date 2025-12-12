#!/usr/bin/env node

/**
 * Script to update exercise names in exercises.json to Title Case
 * Capitalizes every individual word in exercise names
 */

const fs = require('fs');
const path = require('path');

const exercisesJsonPath = path.join(__dirname, '../assets/exercises/exercises.json');

function titleCase(str) {
  if (!str) return str

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

function main() {
  console.log('Reading exercises.json...\n');
  
  if (!fs.existsSync(exercisesJsonPath)) {
    console.error(`❌ Error: File not found at ${exercisesJsonPath}`);
    process.exit(1);
  }
  
  const fileContent = fs.readFileSync(exercisesJsonPath, 'utf8');
  const exercises = JSON.parse(fileContent);
  
  if (!Array.isArray(exercises)) {
    console.error('❌ Error: exercises.json should contain an array');
    process.exit(1);
  }
  
  console.log(`Found ${exercises.length} exercises\n`);
  console.log('Updating exercise names to Title Case...\n`);
  
  let updated = 0;
  let unchanged = 0;
  
  exercises.forEach((exercise, index) => {
    if (!exercise.name) {
      return;
    }
    
    const originalName = exercise.name;
    const cleanedName = titleCase(originalName);
    
    if (originalName === cleanedName) {
      unchanged++;
      return;
    }
    
    exercise.name = cleanedName;
    updated++;
    console.log(`✓ Updated: "${originalName}" → "${cleanedName}"`);
  });
  
  console.log(`\n📊 Summary:`);
  console.log(`  ✅ Updated: ${updated}`);
  console.log(`  ⏭️  Unchanged: ${unchanged}`);
  console.log('\nWriting updated exercises.json...');
  
  // Write back with proper formatting (2 space indent)
  fs.writeFileSync(
    exercisesJsonPath,
    JSON.stringify(exercises, null, 2) + '\n',
    'utf8'
  );
  
  console.log('✅ Done!');
}

main();

