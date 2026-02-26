export type FoodLibraryCommonFoodItem = {
  id: string
  name: string
  servingSize: string
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

export const FOOD_LIBRARY_COMMON_FOODS: FoodLibraryCommonFoodItem[] = [
  { id: 'usda-common-eggs', name: 'Eggs', servingSize: '100 g', calories: 140, protein_g: 12, carbs_g: 1, fat_g: 10 },
  { id: 'usda-common-egg-whites', name: 'Egg Whites', servingSize: '100 g', calories: 51, protein_g: 11, carbs_g: 1, fat_g: 0 },
  { id: 'usda-common-chicken-breast', name: 'Chicken Breast', servingSize: '113 g cooked', calories: 187, protein_g: 35, carbs_g: 0, fat_g: 4 },
  { id: 'usda-common-chicken-thigh', name: 'Chicken Thigh', servingSize: '113 g cooked', calories: 229, protein_g: 28, carbs_g: 0, fat_g: 13 },
  { id: 'usda-common-ground-turkey', name: 'Ground Turkey (93% lean)', servingSize: '113 g cooked', calories: 170, protein_g: 22, carbs_g: 0, fat_g: 9 },
  { id: 'usda-common-ground-beef', name: 'Ground Beef (90% lean)', servingSize: '113 g cooked', calories: 200, protein_g: 23, carbs_g: 0, fat_g: 11 },
  { id: 'usda-common-salmon', name: 'Salmon', servingSize: '113 g cooked', calories: 233, protein_g: 25, carbs_g: 0, fat_g: 14 },
  { id: 'usda-common-tuna', name: 'Tuna (canned in water)', servingSize: '142 g drained', calories: 120, protein_g: 26, carbs_g: 0, fat_g: 1 },
  { id: 'usda-common-shrimp', name: 'Shrimp', servingSize: '113 g cooked', calories: 112, protein_g: 24, carbs_g: 0, fat_g: 1 },
  { id: 'usda-common-tofu', name: 'Tofu (firm)', servingSize: '85 g', calories: 80, protein_g: 9, carbs_g: 2, fat_g: 4 },
  { id: 'usda-common-tempeh', name: 'Tempeh', servingSize: '85 g', calories: 160, protein_g: 16, carbs_g: 9, fat_g: 9 },
  { id: 'usda-common-greek-yogurt', name: 'Greek Yogurt (nonfat)', servingSize: '170 g', calories: 100, protein_g: 17, carbs_g: 6, fat_g: 0 },
  { id: 'usda-common-cottage-cheese', name: 'Cottage Cheese (low-fat)', servingSize: '113 g', calories: 90, protein_g: 12, carbs_g: 5, fat_g: 2 },
  { id: 'usda-common-cheddar', name: 'Cheddar Cheese', servingSize: '28 g', calories: 115, protein_g: 7, carbs_g: 1, fat_g: 9 },
  { id: 'usda-common-whey', name: 'Whey Protein Powder', servingSize: '1 scoop (30g)', calories: 120, protein_g: 24, carbs_g: 3, fat_g: 1 },
  { id: 'usda-common-milk-2', name: 'Milk (2%)', servingSize: '244 g', calories: 122, protein_g: 8, carbs_g: 12, fat_g: 5 },
  { id: 'usda-common-almond-milk', name: 'Almond Milk (unsweetened)', servingSize: '240 g', calories: 30, protein_g: 1, carbs_g: 1, fat_g: 2 },
  { id: 'usda-common-white-rice', name: 'White Rice', servingSize: '158 g cooked', calories: 205, protein_g: 4, carbs_g: 45, fat_g: 0 },
  { id: 'usda-common-brown-rice', name: 'Brown Rice', servingSize: '195 g cooked', calories: 216, protein_g: 5, carbs_g: 45, fat_g: 2 },
  { id: 'usda-common-oats', name: 'Rolled Oats', servingSize: '40 g dry', calories: 150, protein_g: 5, carbs_g: 27, fat_g: 3 },
  { id: 'usda-common-quinoa', name: 'Quinoa', servingSize: '185 g cooked', calories: 222, protein_g: 8, carbs_g: 39, fat_g: 4 },
  { id: 'usda-common-pasta', name: 'Pasta (cooked)', servingSize: '140 g cooked', calories: 200, protein_g: 7, carbs_g: 42, fat_g: 1 },
  { id: 'usda-common-whole-wheat-bread', name: 'Whole Wheat Bread', servingSize: '56 g', calories: 140, protein_g: 8, carbs_g: 24, fat_g: 2 },
  { id: 'usda-common-sourdough', name: 'Sourdough Bread', servingSize: '64 g', calories: 185, protein_g: 7, carbs_g: 36, fat_g: 1 },
  { id: 'usda-common-flour-tortilla', name: 'Flour Tortilla', servingSize: '71 g', calories: 220, protein_g: 6, carbs_g: 36, fat_g: 5 },
  { id: 'usda-common-corn-tortilla', name: 'Corn Tortilla', servingSize: '52 g', calories: 104, protein_g: 3, carbs_g: 22, fat_g: 1 },
  { id: 'usda-common-bagel', name: 'Bagel (plain)', servingSize: '95 g', calories: 277, protein_g: 10, carbs_g: 55, fat_g: 2 },
  { id: 'usda-common-potato', name: 'Potato (russet)', servingSize: '173 g baked', calories: 160, protein_g: 4, carbs_g: 37, fat_g: 0 },
  { id: 'usda-common-sweet-potato', name: 'Sweet Potato', servingSize: '130 g', calories: 112, protein_g: 2, carbs_g: 26, fat_g: 0 },
  { id: 'usda-common-black-beans', name: 'Black Beans', servingSize: '86 g cooked', calories: 114, protein_g: 8, carbs_g: 20, fat_g: 0 },
  { id: 'usda-common-chickpeas', name: 'Chickpeas', servingSize: '82 g cooked', calories: 135, protein_g: 7, carbs_g: 22, fat_g: 2 },
  { id: 'usda-common-lentils', name: 'Lentils', servingSize: '99 g cooked', calories: 115, protein_g: 9, carbs_g: 20, fat_g: 0 },
  { id: 'usda-common-banana', name: 'Banana', servingSize: '118 g', calories: 105, protein_g: 1, carbs_g: 27, fat_g: 0 },
  { id: 'usda-common-apple', name: 'Apple', servingSize: '182 g', calories: 95, protein_g: 0, carbs_g: 25, fat_g: 0 },
  { id: 'usda-common-blueberries', name: 'Blueberries', servingSize: '148 g', calories: 84, protein_g: 1, carbs_g: 21, fat_g: 0 },
  { id: 'usda-common-strawberries', name: 'Strawberries', servingSize: '152 g', calories: 49, protein_g: 1, carbs_g: 12, fat_g: 0 },
  { id: 'usda-common-orange', name: 'Orange', servingSize: '131 g', calories: 62, protein_g: 1, carbs_g: 15, fat_g: 0 },
  { id: 'usda-common-grapes', name: 'Grapes', servingSize: '151 g', calories: 104, protein_g: 1, carbs_g: 27, fat_g: 0 },
  { id: 'usda-common-avocado', name: 'Avocado', servingSize: '75 g', calories: 120, protein_g: 2, carbs_g: 6, fat_g: 11 },
  { id: 'usda-common-broccoli', name: 'Broccoli', servingSize: '156 g cooked', calories: 55, protein_g: 4, carbs_g: 11, fat_g: 1 },
  { id: 'usda-common-spinach', name: 'Spinach', servingSize: '180 g cooked', calories: 41, protein_g: 5, carbs_g: 7, fat_g: 0 },
  { id: 'usda-common-carrots', name: 'Carrots', servingSize: '128 g raw', calories: 52, protein_g: 1, carbs_g: 12, fat_g: 0 },
  { id: 'usda-common-bell-pepper', name: 'Bell Pepper', servingSize: '119 g', calories: 24, protein_g: 1, carbs_g: 6, fat_g: 0 },
  { id: 'usda-common-cucumber', name: 'Cucumber', servingSize: '104 g sliced', calories: 16, protein_g: 1, carbs_g: 4, fat_g: 0 },
  { id: 'usda-common-tomato', name: 'Tomato', servingSize: '123 g', calories: 22, protein_g: 1, carbs_g: 5, fat_g: 0 },
  { id: 'usda-common-mixed-greens', name: 'Mixed Greens', servingSize: '60 g', calories: 20, protein_g: 2, carbs_g: 4, fat_g: 0 },
  { id: 'usda-common-olive-oil', name: 'Olive Oil', servingSize: '14 g', calories: 119, protein_g: 0, carbs_g: 0, fat_g: 14 },
  { id: 'usda-common-peanut-butter', name: 'Peanut Butter', servingSize: '32 g', calories: 190, protein_g: 8, carbs_g: 7, fat_g: 16 },
  { id: 'usda-common-almonds', name: 'Almonds', servingSize: '28 g', calories: 164, protein_g: 6, carbs_g: 6, fat_g: 14 },
  { id: 'usda-common-walnuts', name: 'Walnuts', servingSize: '28 g', calories: 185, protein_g: 4, carbs_g: 4, fat_g: 18 },
]
