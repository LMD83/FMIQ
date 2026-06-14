/**
 * Charity Cloud — need taxonomy v1 (single source of truth for FE and BE).
 *
 * 8 top categories / ~40 subcategories, per docs/08 build script Sprint 1.
 * The banned list is a separate export and is enforced as a WHITELIST check at
 * the mutation layer (CLAUDE.md rule 8) — anything not in the taxonomy is
 * rejected, and the banned items below are additionally never present in it.
 *
 * Versioned data: bump TAXONOMY_VERSION when categories change so needs rows
 * can be migrated/interpreted.
 */

export const TAXONOMY_VERSION = 1 as const;

export const TAXONOMY = {
  mobility_equipment: {
    label: "Mobility equipment",
    subcategories: {
      wheelchair: "Wheelchair",
      walker_rollator: "Walker / rollator",
      crutches_sticks: "Crutches / walking sticks",
      shower_bath_aid: "Shower / bath aid",
      grab_rails: "Grab rails",
    },
  },
  baby_child: {
    label: "Baby & child",
    subcategories: {
      pram_buggy: "Pram / buggy",
      baby_clothes: "Baby clothes",
      child_clothes: "Children's clothes",
      toys_indoor: "Toys (indoor)",
      stair_gate: "Stair gate",
      high_chair: "High chair",
    },
  },
  furniture: {
    label: "Furniture",
    subcategories: {
      bed_frame: "Bed frame",
      sofa_armchair: "Sofa / armchair",
      table_chairs: "Table & chairs",
      wardrobe_drawers: "Wardrobe / chest of drawers",
      desk: "Desk",
    },
  },
  bedding_warmth: {
    label: "Bedding & warmth",
    subcategories: {
      duvet_new: "Duvet (new only)",
      blankets: "Blankets",
      bed_linen: "Bed linen",
      pillows_new: "Pillows (new only)",
      hot_water_bottle: "Hot water bottle",
    },
  },
  clothing: {
    label: "Clothing",
    subcategories: {
      adult_clothes: "Adult clothes",
      coats_jackets: "Coats & jackets",
      shoes_boots: "Shoes & boots",
      school_uniform: "School uniform",
      workwear: "Workwear (interview / first job)",
    },
  },
  kitchen_household: {
    label: "Kitchen & household",
    subcategories: {
      pots_pans: "Pots & pans",
      crockery_cutlery: "Crockery & cutlery",
      small_appliance_pat: "Small appliance (PAT-tested)",
      cleaning_starter: "Cleaning starter kit",
      towels: "Towels",
      curtains_blinds: "Curtains / blinds",
    },
  },
  education_school: {
    label: "Education & school",
    subcategories: {
      school_bag: "School bag",
      stationery: "Stationery",
      books_textbooks: "Books / textbooks",
      laptop_tablet_pat: "Laptop / tablet (PAT-tested)",
      calculator: "Calculator",
    },
  },
  outdoor_camping: {
    label: "Outdoor & camping",
    subcategories: {
      sleeping_bag: "Sleeping bag",
      tent: "Tent",
      rain_gear: "Rain gear",
      rucksack: "Rucksack",
      bicycle_adult: "Bicycle (adult, safety-checked)",
    },
  },
} as const;

export type Category = keyof typeof TAXONOMY;
export type Subcategory<C extends Category = Category> =
  keyof (typeof TAXONOMY)[C]["subcategories"] & string;

export const CATEGORIES = Object.keys(TAXONOMY) as Category[];

/**
 * Banned categories — NEVER accepted, regardless of taxonomy membership
 * (docs/02 regulatory: safety-critical second-hand goods; no food, no money).
 * Kept as a separate export so the mutation layer can both whitelist-check the
 * taxonomy AND assert none of these terms appear (defence in depth).
 */
export const BANNED_ITEMS = [
  "car seat",
  "booster seat",
  "cot",
  "cot mattress",
  "mattress",
  "helmet",
  "untested electrical",
  "blind cord",
  "food",
  "formula",
  "medicine",
  "money",
  "voucher",
] as const;

/** True iff `category`/`subcategory` is a valid taxonomy pair. */
export function isAllowedCategory(category: string, subcategory: string): boolean {
  const cat = (TAXONOMY as Record<string, { subcategories: Record<string, string> }>)[category];
  if (!cat) return false;
  return Object.prototype.hasOwnProperty.call(cat.subcategories, subcategory);
}

/** Charity purpose → categories it may post under (Sprint 2; flagged for review). */
export const PURPOSE_TO_CATEGORIES: Record<string, Category[]> = {
  homelessness: [
    "bedding_warmth",
    "clothing",
    "kitchen_household",
    "outdoor_camping",
    "furniture",
  ],
  family_support: ["baby_child", "clothing", "furniture", "kitchen_household", "education_school"],
  disability: ["mobility_equipment", "furniture", "bedding_warmth", "kitchen_household"],
  older_persons: ["mobility_equipment", "bedding_warmth", "furniture", "kitchen_household"],
  education_youth: ["education_school", "clothing", "outdoor_camping"],
  migrant_refugee_support: [
    "clothing",
    "bedding_warmth",
    "kitchen_household",
    "furniture",
    "baby_child",
    "education_school",
  ],
  general_community: CATEGORIES,
};
