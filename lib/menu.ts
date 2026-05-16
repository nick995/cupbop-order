// Cupbop Park City menu data.
// Each "Cupbop" = base bowl (rice + cabbage + noodles) + ONE protein + ONE spicy level + qty.

export const BASE_PRICE = 11.95;

export interface Protein {
  id: string;
  name: string;
  description: string;
  upcharge: number;       // extra cost added to BASE_PRICE
  emoji: string;          // fallback if image fails to load
  imageUrl: string;       // official Cupbop / Olo CDN image
  isGlutenFree?: boolean;
  isPopular?: boolean;    // shows a "Popular" badge on the card
}

// Note: these URLs include imgix signatures (s=...) which lock them to specific
// query params (w=120 h=120). We can't regenerate signatures without the secret,
// so the size is fixed at 120x120. For production it's recommended to download
// these images and host them locally under /public/images/proteins/.

export interface SpicyLevel {
  id: string;
  name: string;            // short label, e.g. "Level 5"
  fullName: string;        // full label as shown on official menu
  description?: string;    // sauces / notes
  heat: 0 | 1 | 2 | 3 | 4 | 5; // 0..5 visual heat scale
}

export const PROTEINS: Protein[] = [
  {
    id: "beef",
    name: "Beef",
    description: "Korean-marinated BBQ beef (GF)",
    upcharge: 1.70,
    emoji: "🥩",
    imageUrl: "https://olo-images-live.imgix.net/ec/ecd1c1f1589f4f1da3ac15779bfc0865.png?auto=format%2Ccompress&q=60&cs=tinysrgb&w=120&h=120&fit=fill&fm=png32&bg=transparent&s=c5974c83be63d1c7c14819879afc7be1",
    isGlutenFree: true,
    isPopular: true,
  },
  {
    id: "rock",
    name: "Rock",
    description: "Tangy glazed fried chicken",
    upcharge: 0,
    emoji: "🍗",
    imageUrl: "https://olo-images-live.imgix.net/26/26f52a362d584fe0821c29fddd28e691.png?auto=format%2Ccompress&q=60&cs=tinysrgb&w=120&h=120&fit=fill&fm=png32&bg=transparent&s=34619640a5c53f608fab0671647a6174",
    isPopular: true,
  },
  {
    id: "mandoo",
    name: "Mandoo",
    description: "Savory chicken potsticker",
    upcharge: 0,
    emoji: "🥟",
    imageUrl: "https://olo-images-live.imgix.net/d7/d7c477e337484a5fb44b87a619af4959.png?auto=format%2Ccompress&q=60&cs=tinysrgb&w=120&h=120&fit=fill&fm=png32&bg=transparent&s=7b783b2419f689ca86af9e3464803120",
  },
  {
    id: "ugly",
    name: "Ugly",
    description: "Korean fried chicken (GF)",
    upcharge: 0,
    emoji: "🍤",
    imageUrl: "https://olo-images-live.imgix.net/67/67733ae6c5e147f2ab866a8e521f679b.png?auto=format%2Ccompress&q=60&cs=tinysrgb&w=120&h=120&fit=fill&fm=png32&bg=transparent&s=7df82d6b7e745f489cd4fae19eabb0c9",
    isGlutenFree: true,
  },
  {
    id: "krunch",
    name: "Krunch",
    description: "Katsu-style Korean fried chicken",
    upcharge: 0,
    emoji: "🍱",
    imageUrl: "https://olo-images-live.imgix.net/49/49225f2e22fb44449fb6aad02460b95e.png?auto=format%2Ccompress&q=60&cs=tinysrgb&w=120&h=120&fit=fill&fm=png32&bg=transparent&s=60cf7c24bb5bcf535e8d67e77301eb8c",
  },
  {
    id: "koko",
    name: "Koko",
    description: "Tender Korean chicken (GF)",
    upcharge: 0,
    emoji: "🐔",
    imageUrl: "https://olo-images-live.imgix.net/57/5796c41419ca4118a0198dfb21be2ac3.png?auto=format%2Ccompress&q=60&cs=tinysrgb&w=120&h=120&fit=fill&fm=png32&bg=transparent&s=1d8b3e7d690d2982fb574cf28cdba119",
    isGlutenFree: true,
  },
  {
    id: "piggy",
    name: "Piggy",
    description: "Spicy Korean BBQ pork",
    upcharge: 0,
    emoji: "🐷",
    imageUrl: "https://olo-images-live.imgix.net/17/1737679f97f044c19fac7c20fca80bb1.png?auto=format%2Ccompress&q=60&cs=tinysrgb&w=120&h=120&fit=fill&fm=png32&bg=transparent&s=548ff372099567fbd3756be4b9eb407d",
  },
  {
    id: "veggie",
    name: "Veggie",
    description: "Mixed veggies (GF)",
    upcharge: 0,
    emoji: "🥬",
    imageUrl: "https://olo-images-live.imgix.net/b0/b03edb38c24e4aa3a98045a4348f1cef.png?auto=format%2Ccompress&q=60&cs=tinysrgb&w=120&h=120&fit=fill&fm=png32&bg=transparent&s=6b03f24fb37358ea590af0d019d3bfa6",
    isGlutenFree: true,
  },
  {
    id: "doochi",
    name: "Doochi",
    description: "Korean-style tofu (GF)",
    upcharge: 0,
    emoji: "🍢",
    imageUrl: "https://olo-images-live.imgix.net/c4/c49452429f584f82a94cfbf42865f51a.png?auto=format%2Ccompress&q=60&cs=tinysrgb&w=120&h=120&fit=fill&fm=png32&bg=transparent&s=8e58a82e24d89ac6f16a2f3c8ffffdcf",
    isGlutenFree: true,
  },
  {
    id: "no-protein",
    name: "No Protein",
    description: "Just rice, cabbage, and noodles",
    upcharge: 0,
    emoji: "🍚",
    imageUrl: "https://olo-images-live.imgix.net/79/79f28c8ab8c249a29d489e3fff797c4b.png?auto=format%2Ccompress&q=60&cs=tinysrgb&w=120&h=120&fit=fill&fm=png32&bg=transparent&s=b1ece4c5bfddced1731d99a225b17fe0",
  },
];

export const SPICY_LEVELS: SpicyLevel[] = [
  { id: "none", name: "No Sauce", fullName: "No Sauce", heat: 0 },
  { id: "bulgogi", name: "Bulgogi Only", fullName: "Bulgogi Only", heat: 0 },
  { id: "lvl1", name: "Level 1 — Sweet", fullName: "Level 1 — Sweet", description: "Bulgogi, Lime Mayo", heat: 1 },
  { id: "lvl2", name: "Level 2", fullName: "Level 2", description: "Bulgogi, Lime Mayo, Spicy Mayo", heat: 1 },
  { id: "lvl3", name: "Level 3", fullName: "Level 3", description: "Bulgogi, Lime Mayo, Spicy Mayo", heat: 2 },
  { id: "lvl4", name: "Level 4", fullName: "Level 4", description: "Bulgogi, Lime Mayo, Spicy Mayo", heat: 2 },
  { id: "lvl5", name: "Level 5 — Medium", fullName: "Level 5 — Medium", description: "Bulgogi, Spicy Mayo", heat: 3 },
  { id: "lvl6", name: "Level 6", fullName: "Level 6", description: "Bulgogi, Spicy Mayo, Korean Chili", heat: 3 },
  { id: "lvl7", name: "Level 7.5", fullName: "Level 7.5", description: "Bulgogi, Spicy Mayo, Korean Chili", heat: 4 },
  { id: "lvl8", name: "Level 8", fullName: "Level 8", description: "Bulgogi, Spicy Mayo, Korean Chili, Fire", heat: 4 },
  { id: "lvl9", name: "Level 9", fullName: "Level 9", description: "Bulgogi, Spicy Mayo, Korean Chili, Fire", heat: 5 },
  { id: "lvl10", name: "Level 10 — Fire in the Hole", fullName: "Level 10 — Fire in the Hole", description: "Bulgogi, Korean Chili, Fire", heat: 5 },
];

export const DEFAULT_SPICY_ID = "lvl5";

// Bowl modifications — base bowl is rice + cabbage mix + noodles.
// Customer may opt to remove any of these (up to 3).
export interface BowlMod {
  id: string;
  name: string;
  imageUrl: string;
}

export const BOWL_MODS: BowlMod[] = [
  {
    id: "no-rice",
    name: "No Rice",
    imageUrl: "https://olo-images-live.imgix.net/16/160111301a8141b681db879ab32e1110.png?auto=format%2Ccompress&q=60&cs=tinysrgb&w=120&h=120&fit=fill&fm=png32&bg=transparent&s=561cfb5966acd4bb4101d7648181501b",
  },
  {
    id: "no-noodle",
    name: "No Noodle",
    imageUrl: "https://olo-images-live.imgix.net/9f/9fa5431b182c45c293ce4b35c3914798.png?auto=format%2Ccompress&q=60&cs=tinysrgb&w=120&h=120&fit=fill&fm=png32&bg=transparent&s=bef327a94961e92850d7d92a23f81b91",
  },
  {
    id: "no-cabbage",
    name: "No Cabbage Mix",
    imageUrl: "https://olo-images-live.imgix.net/ca/ca44fd78557d4cbbac9b5555dba8362f.png?auto=format%2Ccompress&q=60&cs=tinysrgb&w=120&h=120&fit=fill&fm=png32&bg=transparent&s=61ccce1414d17b75643a56cd7200c154",
  },
];

export function findBowlMod(id: string): BowlMod | undefined {
  return BOWL_MODS.find((m) => m.id === id);
}

export function findProtein(id: string): Protein | undefined {
  return PROTEINS.find((p) => p.id === id);
}

export function findSpicy(id: string): SpicyLevel | undefined {
  return SPICY_LEVELS.find((s) => s.id === id);
}

export function priceForProtein(proteinId: string): number {
  const p = findProtein(proteinId);
  return BASE_PRICE + (p?.upcharge ?? 0);
}
