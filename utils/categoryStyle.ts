import {
  Banknote, BookOpen, Briefcase, Bus, Car, CupSoda, Dices, Film, Gift, GraduationCap, HandCoins, Home, Landmark,
  PiggyBank, Pill, Plane, Shirt, ShoppingCart, Sparkles, Store, Ticket, Utensils, Zap, Gamepad2, Smartphone, PawPrint, Dumbbell,
  type LucideIcon,
} from 'lucide-react';

/** One fixed set of flat tile colors that sit well together. Categories pick from it; nothing else uses these. */
export const TILE = {
  sun: '#FFD23F', coral: '#FF9F7A', pink: '#FFB3D1', lilac: '#C9B8FF',
  sky: '#82B8FF', aqua: '#7FDDE0', mint: '#62E3A4', lime: '#C8EB6A',
} as const;
export const TILE_COLORS: string[] = Object.values(TILE);
export const NEUTRAL_TILE = '#E4E0D6';

/** Icon names a category's `icon` field may hold (alongside emoji). Shown in the Categories editor. */
export const ICONS: Record<string, LucideIcon> = {
  utensils: Utensils, cup: CupSoda, cart: ShoppingCart, bus: Bus, car: Car, film: Film, plane: Plane, pill: Pill,
  book: BookOpen, school: GraduationCap, shirt: Shirt, sparkles: Sparkles, banknote: Banknote, briefcase: Briefcase,
  gift: Gift, home: Home, piggy: PiggyBank, dice: Dices, store: Store, ticket: Ticket, hand: HandCoins, landmark: Landmark,
  zap: Zap, game: Gamepad2, phone: Smartphone, paw: PawPrint, gym: Dumbbell,
};

// First matching rule wins. Names are matched case-insensitively as substrings.
const RULES: Array<[RegExp, string, string]> = [
  [/meal|food|dining|restaurant|lunch|dinner|breakfast|eat/, 'utensils', TILE.coral],
  [/drink|coffee|tea\b|bar\b|boba/, 'cup', TILE.sun],
  [/grocer|supermarket|market/, 'cart', TILE.lime],
  [/taxi|uber|cab\b|fuel|parking|car\b/, 'car', TILE.aqua],
  [/transport|bus|mtr|train|metro|transit/, 'bus', TILE.sky],
  [/entertain|movie|film|cinema|fun\b/, 'film', TILE.lilac],
  [/game|gaming/, 'game', TILE.lilac],
  [/travel|trip|flight|hotel|holiday/, 'plane', TILE.aqua],
  [/medic|health|doctor|pharm|clinic/, 'pill', TILE.pink],
  [/educat|school|course|tuition|study/, 'school', TILE.sky],
  [/cloth|fashion|shoe/, 'shirt', TILE.pink],
  [/beauty|hair|cosmetic|skin/, 'sparkles', TILE.lilac],
  [/rent|home|house|utilit/, 'home', TILE.coral],
  [/phone|mobile|internet|data\b/, 'phone', TILE.sky],
  [/gym|sport|fitness/, 'gym', TILE.mint],
  [/pet/, 'paw', TILE.coral],
  [/\b247\b|24\/7|convenience|7.?eleven/, 'store', TILE.lime],
  [/jockey|horse|race/, 'ticket', TILE.sun],
  [/receiv|owed|receivable/, 'hand', TILE.coral],
  [/\bhall\b/, 'landmark', TILE.lilac],
  [/salary|wage|bonus|paycheck/, 'banknote', TILE.mint],
  [/intern|job|work|freelance|business/, 'briefcase', TILE.aqua],
  [/saving|invest|interest/, 'piggy', TILE.lime],
  [/gambl|bet\b|casino/, 'dice', TILE.coral],
  [/laisee|lai see|gift|red packet/, 'gift', TILE.pink],
];

export interface CategoryStyle {
  Icon?: LucideIcon;
  emoji?: string;
  letter: string;
  color: string;
}

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Resolve how a category renders: explicit color/icon win, then name-based defaults, then a letter tile. */
export function categoryStyle(cat?: { name: string; icon?: string; color?: string }): CategoryStyle {
  if (!cat) return { letter: '?', color: NEUTRAL_TILE };
  const name = cat.name.trim();
  const lower = name.toLowerCase();
  const rule = RULES.find(([re]) => re.test(lower));
  const color = cat.color || rule?.[2] || TILE_COLORS[hash(lower) % TILE_COLORS.length];
  const letter = (name[0] ?? '?').toUpperCase();
  const icon = cat.icon?.trim();
  if (icon && ICONS[icon.toLowerCase()]) return { Icon: ICONS[icon.toLowerCase()], letter, color };
  if (icon) return { emoji: icon, letter, color };
  const key = rule?.[1];
  return { Icon: key ? ICONS[key] : undefined, letter, color };
}
