// Cuisine options shown in the dropdown. `type` is Google's place type name
// (see "Table A" in the Places API docs).

// Selecting none means "any restaurant". The first few are shown before "More".
export const CUISINES = [
  { type: "american_restaurant", label: "American" },
  { type: "barbecue_restaurant", label: "BBQ" },
  { type: "breakfast_restaurant", label: "Breakfast" },
  { type: "brunch_restaurant", label: "Brunch" },
  { type: "hamburger_restaurant", label: "Burgers" },
  { type: "chinese_restaurant", label: "Chinese" },
  { type: "french_restaurant", label: "French" },
  { type: "greek_restaurant", label: "Greek" },
  { type: "indian_restaurant", label: "Indian" },
  { type: "italian_restaurant", label: "Italian" },
  { type: "japanese_restaurant", label: "Japanese" },
  { type: "korean_restaurant", label: "Korean" },
  { type: "mediterranean_restaurant", label: "Mediterranean" },
  { type: "mexican_restaurant", label: "Mexican" },
  { type: "middle_eastern_restaurant", label: "Middle Eastern" },
  { type: "pizza_restaurant", label: "Pizza" },
  { type: "ramen_restaurant", label: "Ramen" },
  { type: "seafood_restaurant", label: "Seafood" },
  { type: "spanish_restaurant", label: "Spanish" },
  { type: "steak_house", label: "Steakhouse" },
  { type: "sushi_restaurant", label: "Sushi" },
  { type: "thai_restaurant", label: "Thai" },
  { type: "vegetarian_restaurant", label: "Vegetarian" },
  { type: "vietnamese_restaurant", label: "Vietnamese" },
] as const;

// Shown first in the picker; the rest are behind a "More" button.
export const POPULAR_CUISINES = [
  "italian_restaurant",
  "mexican_restaurant",
  "japanese_restaurant",
  "sushi_restaurant",
  "thai_restaurant",
  "chinese_restaurant",
  "indian_restaurant",
  "american_restaurant",
  "pizza_restaurant",
  "mediterranean_restaurant",
];

export function cuisineLabel(type: string): string {
  return CUISINES.find((c) => c.type === type)?.label ?? "Restaurant";
}
