#!/usr/bin/env node

/**
 * Script to update targetMuscles in exercises.json to match database muscle group categories
 * 
 * Mapping:
 * - "calves" → "Calves"
 * - "glutes" → "Glutes"
 * - "delts" → "Shoulders"
 * - "pectorals" → "Chest"
 * - "biceps" → "Biceps"
 * - "triceps" → "Triceps"
 * - "abs" → "Core"
 * - "lats" → "Back"
 * - "upper back" → "Back"
 * - "spine" → "Back"
 * - "forearms" → "Forearms"
 */

const fs = require('fs');
const path = require('path');

const MUSCLE_GROUP_MAPPING = {
  'calves': 'Calves',
  'glutes': 'Glutes',
  'delts': 'Shoulders',
  'pectorals': 'Chest',
  'biceps': 'Biceps',
  'triceps': 'Triceps',
  'abs': 'Core',
  'lats': 'Back',
  'upper back': 'Back',
  'spine': 'Back',
  'forearms': 'Forearms',
};

const exercisesJsonPath = path.join(__dirname, '../assets/exercises/exercises.json');

function updateMuscleGroups(exercises) {
  let updatedCount = 0;
  
  exercises.forEach((exercise, index) => {
    if (!exercise.targetMuscles || !Array.isArray(exercise.targetMuscles)) {
      return;
    }
    
    const originalMuscles = [...exercise.targetMuscles];
    const updatedMuscles = exercise.targetMuscles.map(muscle => {
      const normalized = muscle.toLowerCase().trim();
      const mapped = MUSCLE_GROUP_MAPPING[normalized];
      
      if (mapped) {
        return mapped;
      }
      
      // Check for partial matches (e.g., "rear deltoids" → "Shoulders")
      if (normalized.includes('delt')) {
        return 'Shoulders';
      }
      if (normalized.includes('pec') || normalized.includes('chest')) {
        return 'Chest';
      }
      if (normalized.includes('lat') || normalized.includes('back')) {
        return 'Back';
      }
      
      // Warn about unmapped muscles
      console.warn(`⚠️  Exercise "${exercise.name}" (index ${index}) has unmapped muscle: "${muscle}"`);
      return muscle; // Keep original if no mapping found
    });
    
    // Remove duplicates while preserving order
    const uniqueMuscles = [...new Set(updatedMuscles)];
    
    if (JSON.stringify(originalMuscles) !== JSON.stringify(uniqueMuscles)) {
      exercise.targetMuscles = uniqueMuscles;
      updatedCount++;
      console.log(`✓ Updated "${exercise.name}": ${originalMuscles.join(', ')} → ${uniqueMuscles.join(', ')}`);
    }
  });
  
  return updatedCount;
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
  console.log('Updating muscle groups...\n');
  
  const updatedCount = updateMuscleGroups(exercises);
  
  console.log(`\n✓ Updated ${updatedCount} exercises`);
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

