import type { Style } from "./types";

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
  { type: "halal_restaurant", label: "Halal" },
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

// Shown first in the picker, under "Popular".
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

// Kinds of place. `searchType`/`query` are used when searching for this style
// directly; `types` decides whether a result counts as this style.
export const STYLES: {
  id: Style;
  label: string;
  searchType: string;
  query: string;
  types: string[];
}[] = [
  { id: "fast_food", label: "Fast food", searchType: "fast_food_restaurant", query: "fast food", types: ["fast_food_restaurant"] },
  // Google has no "fast casual" or "sit-down" type: casual = not fast food, not fine dining.
  { id: "casual", label: "Casual", searchType: "restaurant", query: "places to eat", types: [] },
  { id: "fine_dining", label: "Fine dining", searchType: "fine_dining_restaurant", query: "fine dining", types: ["fine_dining_restaurant"] },
  { id: "bar", label: "Bar & pub", searchType: "bar", query: "bars and pubs", types: ["bar", "pub", "bar_and_grill", "wine_bar", "sports_bar", "brewpub", "cocktail_bar"] },
  { id: "cafe", label: "Café", searchType: "cafe", query: "cafes", types: ["cafe", "coffee_shop", "bakery", "tea_house"] },
];

export function matchesStyle(types: string[], price: number | undefined, styles: Style[]): boolean {
  if (styles.length === 0) return true;
  const has = (list: string[]) => list.some((t) => types.includes(t));
  return styles.some((s) => {
    if (s === "casual") return !has(["fast_food_restaurant", "fine_dining_restaurant"]) && price !== 4;
    if (s === "fine_dining" && price === 4) return true;
    return has(STYLES.find((x) => x.id === s)!.types);
  });
}
