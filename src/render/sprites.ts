import { Accessory, Hair, Hat, Outfit } from '../data/looks';
import { CITIES } from '../data/franchise';
import { Bubble, Emote, Expression, Held } from '../sim/types';
import { characterSprites } from './art/charArt';
import { decorSprites } from './art/decorArt';
import { dishSprites } from './art/dishArt';
import { moreDishSprites } from './art/dishArt2';
import { crewSprites } from './art/crewArt';
import { HUB_SPRITES, hubSprites, SCREEN_ROWS } from './art/hubArt';
import { BAR_DECOR_SPRITES, barDecorSprites } from './art/barDecorArt';
import { workSprites } from './art/workArt';
import { SITE_SPRITES, siteSprites } from './art/siteArt';
import { HOST_STAND_LOOKS, hostSprites } from './art/hostArt';
import { eventSprites } from './art/eventArt';
import { deliverySprites, SCOOTER_COLORS } from './art/deliveryArt';
import { CAR_COLORS, parkSprites, STALL_COLORS } from './art/parkArt';
import { FESTIVAL_THEMES } from '../data/events';
import { fxSprites } from './art/fxArt';
import { REQUEST_BADGES, serviceSprites } from './art/serviceArt';
import { CRATES, supplySprites } from './art/supplyArt';
import { dessertSprites } from './art/dessertArt';
import { DESSERTS } from '../data/desserts';
import { GLYPH_ADVANCE, GLYPH_CHARS, glyphSprites } from './art/glyphArt';
import { LOCK_BOARDS, propSprites } from './art/propArt';
import { LOOKS, stationSprites } from './art/stationArt';
import { RUG_COLORS, tableSprites } from './art/tableArt';
import { barSprites, DRINK_SPRITES } from './art/barArt';
import { kitchenSprites, STATION_SPRITES } from './art/kitchenArt';
import { ROOM_PIECE_SPRITES, roomSprites, SIGN_COUNT, WALL_STYLES, WC_SPRITES } from './art/roomArt';
import { BACK_KINDS, PREP_KINDS } from '../data/maps';
import { BlendMode, Skia, TileMode } from '@shopify/react-native-skia';
import { sprite, type SpriteDef } from './sprite';

const BASE = { ...characterSprites, ...propSprites, ...stationSprites, ...kitchenSprites, ...tableSprites, ...barSprites, ...decorSprites, ...dishSprites, ...moreDishSprites, ...crewSprites, ...hubSprites, ...barDecorSprites, ...workSprites, ...eventSprites, ...deliverySprites, ...parkSprites, ...fxSprites, ...glyphSprites, ...roomSprites, ...dessertSprites, ...siteSprites, ...hostSprites, ...serviceSprites, ...supplySprites };

/** Stations whose top looks get a golden aura (from the gold milestone on). */
const GLOW_BASES = [...STATION_SPRITES, 'stove', 'sink', 'fridge', 'table', 'tableSquare', 'tableSmall', 'tableRound4', 'tableLongBack', 'tableLongMid', 'tableLongFront', 'booth', 'boothSeat', 'boothRest', 'barY', 'barXBack', 'barCornerBack', 'barCornerFront', 'barXFront', 'barStool', 'packTable', 'chair', 'chairSeat', 'chairRest', 'plantPalm', 'plantBush', 'neonBoard', 'streetSign', 'flowers', 'floorLamp', 'aquarium', 'statue', 'fountain', 'piano'];
const GLOW_PAD = 4;

/**
 * The aura baked once: the sprite's silhouette spread a few px around and softly blurred, in
 * gold. One draw per frame instead of eight overlapping copies (which, on a hundred golden
 * tables and chairs, was most of the late game's frame time).
 */
function glowOf(def: SpriteDef): SpriteDef {
  const [l, t, r, b] = def.bounds;
  return sprite([l - GLOW_PAD, t - GLOW_PAD, r + GLOW_PAD, b + GLOW_PAD], (c) => {
    const layer = Skia.Paint();
    layer.setColorFilter(Skia.ColorFilter.MakeBlend(Skia.Color('#FFD23F'), BlendMode.SrcIn));
    layer.setImageFilter(Skia.ImageFilter.MakeBlur(1.2, 1.2, TileMode.Decal, null));
    c.saveLayer(layer);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      c.save();
      c.translate(Math.cos(a) * 2.6, Math.sin(a) * 2.6 * 0.8);
      def.draw(c);
      c.restore();
    }
    c.restore();
  });
}

/** `<look>Glow` for the top looks (the last one, and the bigger one at Lv 100 where there is one). */
const GLOWS: Record<string, SpriteDef> = {};
for (const base of GLOW_BASES) {
  for (const n of [LOOKS - 1, LOOKS]) {
    const def = (BASE as Record<string, SpriteDef>)[`${base}${n}`];
    if (def) GLOWS[`${base}${n}Glow`] = glowOf(def);
  }
}

const ALL = { ...BASE, ...GLOWS };
export type SpriteName = keyof typeof characterSprites | keyof typeof propSprites | keyof typeof stationSprites | keyof typeof kitchenSprites | keyof typeof tableSprites | keyof typeof barSprites | keyof typeof decorSprites | keyof typeof dishSprites | keyof typeof moreDishSprites | keyof typeof crewSprites | keyof typeof hubSprites | keyof typeof barDecorSprites | keyof typeof workSprites | keyof typeof eventSprites | keyof typeof deliverySprites | keyof typeof parkSprites | keyof typeof fxSprites | keyof typeof dessertSprites | keyof typeof siteSprites | keyof typeof hostSprites | keyof typeof serviceSprites | keyof typeof supplySprites;

export const SPRITE_DEFS: SpriteDef[] = Object.values(ALL);

export function spriteDef(name: SpriteName): SpriteDef {
  return (ALL as Record<string, SpriteDef>)[name]!;
}

const INDEX = Object.fromEntries(Object.keys(ALL).map((name, i) => [name, i])) as Record<string, number>;

/** Every sprite's name (the browser's art review lists them; index.web.ts). */
export const spriteNames = (): string[] => Object.keys(ALL);
/** Sprite name -> atlas index. Worklets use these plain numbers. */
export const S = INDEX as Record<SpriteName, number>;

const NONE = -1;
const size = (e: object) => Object.keys(e).length;

/** Dense lookup array indexed by enum value; missing entries draw nothing. */
function byEnum(n: number, entries: readonly (readonly [number, string])[]): number[] {
  const out = new Array<number>(n).fill(NONE);
  for (const [i, name] of entries) {
    const idx = INDEX[name];
    if (idx === undefined) throw new Error(`Unknown sprite ${name}`);
    out[i] = idx;
  }
  return out;
}

/** Front (F) and back (B) variants for an enum-driven layer. */
function views(n: number, entries: [number, string][]): { F: number[]; B: number[] } {
  return {
    F: byEnum(n, entries.map(([i, base]) => [i, `${base}F`])),
    B: byEnum(n, entries.map(([i, base]) => [i, `${base}B`])),
  };
}

/** The milestone looks of a station: `base0`..`base3`, plus `base4` for the ones that expand. */
const looks = (base: string): number[] => {
  const out = Array.from({ length: LOOKS }, (_, t) => {
    const idx = INDEX[`${base}${t}`];
    if (idx === undefined) throw new Error(`Unknown sprite ${base}${t}`);
    return idx;
  });
  const big = INDEX[`${base}${LOOKS}`];
  if (big !== undefined) out.push(big);
  return out;
};

const TREE_SPRITE = { palm: 'treePalm', round: 'treeRound', olive: 'treeOlive', cypress: 'treeCypress' } as const;

/** Order icon and plated look per dish id (src/data/dishes.ts order). */
export const DISH_ICONS = ['fries', 'burger', 'iconFalafel', 'iconShawarma', 'iconHummus', 'iconSchnitzel', 'iconShakshuka', 'iconIceCream', 'iconPizza', 'iconSushi', 'iconSteak', 'iconCake', 'iconLobster', 'iconSalad', 'iconPadThai'] as const;
const DISH_PLATES = ['plateFries', 'plateBurger', 'plateFalafel', 'plateShawarma', 'plateHummus', 'plateSchnitzel', 'plateShakshuka', 'plateIceCream', 'platePizza', 'plateSushi', 'plateSteak', 'plateCake', 'plateLobster', 'plateSalad', 'platePadThai'] as const;

/** Every enum-driven layer the renderer needs, as plain arrays (worklet friendly). */
export const LAYERS = {
  hair: views(size(Hair), [[Hair.Short, 'hairShort'], [Hair.Bob, 'hairBob'], [Hair.Ponytail, 'hairPonytail'], [Hair.Curly, 'hairCurly'], [Hair.Spiky, 'hairSpiky'], [Hair.Bun, 'hairBun']]),
  hat: views(size(Hat), [[Hat.Toque, 'hatToque'], [Hat.Cap, 'hatCap'], [Hat.SunHat, 'hatSun'], [Hat.Beanie, 'hatBeanie'], [Hat.Bandana, 'hatBandana'],
    [Hat.HardHat, 'hatHard'], [Hat.Beret, 'hatBeret'], [Hat.Headband, 'hatHeadband'], [Hat.PartyHat, 'hatParty'], [Hat.TopHat, 'hatTop']]),
  outfit: views(size(Outfit), [[Outfit.Tee, 'tee'], [Outfit.Suit, 'suit'], [Outfit.Hawaiian, 'hawaiian'], [Outfit.Hoodie, 'hoodie'], [Outfit.Chef, 'chef'], [Outfit.Waiter, 'waiter'], [Outfit.Washer, 'washer'],
    [Outfit.Cardigan, 'cardigan'], [Outfit.Tracksuit, 'tracksuit'], [Outfit.HiVis, 'hiVis'], [Outfit.Sequin, 'sequin']]),
  face: byEnum(size(Expression), [[Expression.Happy, 'faceHappy'], [Expression.Neutral, 'faceNeutral'], [Expression.Angry, 'faceAngry'], [Expression.Sleepy, 'faceSleepy'], [Expression.Eating, 'faceEating']]),
  faceAccessory: byEnum(size(Accessory), [[Accessory.Sunglasses, 'sunglasses'], [Accessory.Glasses, 'glasses'], [Accessory.Monocle, 'monocle']]),
  emote: byEnum(size(Emote), [[Emote.Heart, 'heart'], [Emote.Anger, 'anger'], [Emote.Clock, 'clock'], [Emote.Coin, 'coin'], [Emote.Star, 'star'], [Emote.Exclaim, 'exclaim'], [Emote.Zzz, 'zzz'], [Emote.Music, 'music']]),
  held: byEnum(size(Held), [[Held.TrayFull, 'trayFull'], [Held.TrayEmpty, 'trayEmpty'], [Held.Phone, 'phone'], [Held.Spatula, 'spatula'], [Held.Menu, 'menu'], [Held.DirtyPlates, 'trayDirty'], [Held.Clipboard, 'clipboard'], [Held.Flyers, 'flyers'], [Held.Bag, 'bag'], [Held.FoodBox, 'foodBox'], [Held.FoodDrink, 'foodDrink'], [Held.Shaker, 'shaker'], [Held.DrinkTray, 'drinkTray'], [Held.Glass, 'glassHeld'],
    [Held.Basket, 'basket'], [Held.Wok, 'wokHeld'], [Held.Knife, 'knife'], [Held.Bowl, 'bowl'], [Held.Ladle, 'ladle'], [Held.Peel, 'peel'], [Held.Tweezers, 'tweezers'], [Held.Notebook, 'notebook'], [Held.MenuOpen, 'menuOpen'], [Held.DessertMenu, 'dessertMenu'], [Held.DessertPlate, 'dessertHeld']]),
  bubble: byEnum(Bubble.DessertBase + DESSERTS.length, [
    [Bubble.Seat, 'seat'],
    [Bubble.Clean, 'clean'],
    [Bubble.NoPlates, 'noPlates'],
    [Bubble.Cv, 'cv'],
    [Bubble.Raise, 'raise'],
    ...DISH_ICONS.map((name, i) => [Bubble.DishBase + i, name] as const),
    ...DRINK_SPRITES.map((name, i) => [Bubble.DrinkBase + i, name] as const),
    ...DESSERTS.map((d, i) => [Bubble.DessertBase + i, `dessert_${d.id}`] as const),
  ]),
  /** Each drink (src/data/bar.ts order). */
  drink: DRINK_SPRITES.map((name) => INDEX[name]!),
  /** Dish icon per dish id (tickets, bubbles). */
  dishIcon: byEnum(DISH_ICONS.length, DISH_ICONS.map((name, i) => [i, name] as const)),
  /** Special-request badges (owner M49, src/data/service.ts REQUESTS order), and the prep stock's bowls. */
  request: REQUEST_BADGES.map((name) => INDEX[name]!),
  prepBowl: [0, 1, 2, 3].map((i) => INDEX[`prepBowl${i}`]!),
  /** The storeroom's crates by ingredient (owner M51, src/data/supply.ts order). */
  crate: CRATES.map((name) => INDEX[name]!),
  /** The padlock sign on later land, by that building's tier. */
  lockSign: LOCK_BOARDS.map((_, tier) => INDEX[`lockSign${tier}`]!),
  /** Couriers' scooters by slot: parked, and with the courier riding it. */
  scooter: SCOOTER_COLORS.map((_, i) => INDEX[`scooter${i}`]!),
  scooterRide: SCOOTER_COLORS.map((_, i) => INDEX[`scooterRide${i}`]!),
  /** Across the street: parked cars and market stalls by color. */
  car: CAR_COLORS.map((_, i) => INDEX[`car${i}`]!),
  stall: STALL_COLORS.map((_, i) => INDEX[`stall${i}`]!),
  /** Festival trophies by theme (src/data/events.ts). */
  trophy: FESTIVAL_THEMES.map((_, i) => INDEX[`trophy${i}`]!),
  /** Tree sprites per city: [city * 2 + map variant] (src/data/franchise.ts). */
  trees: CITIES.flatMap((city) => city.trees.map((k) => INDEX[TREE_SPRITE[k]]!)),
  /** A rug under each table, by table style (src/data/tables.ts) and then color. */
  rug: ['rugRound', 'rugRect', 'rugLong', 'rugRect', 'rugLong3', 'rugLong4'].map((shape) => RUG_COLORS.map((_, k) => INDEX[`${shape}${k}`]!)),
  /** The kitchen's stations by kind (src/data/kitchen.ts), each by milestone look; the prep tables; what cooks on them, by dish. */
  station: STATION_SPRITES.map((name) => looks(name)),
  prep: [...Array.from({ length: PREP_KINDS }, (_, i) => INDEX[`prep${i}`]!), ...Array.from({ length: BACK_KINDS }, (_, i) => INDEX[`back${i}`]!)],
  plaque: [0, 1, 2, 3].map((i) => INDEX[`guidePlaque${i}`]!),
  /** The host's stand, one design per milestone of its upgrade (src/render/art/hostArt.ts). */
  hostStand: Array.from({ length: HOST_STAND_LOOKS }, (_, k) => INDEX[`hostStand${k}`]!),
  /** A new building's site, by SiteItem (src/render/art/siteArt.ts SITE_SPRITES). */
  site: SITE_SPRITES.map((name) => INDEX[name]!),
  /** The pass and its heat lamps a tile at a time: the short one's 3 slabs, then the long one's 5 (variant 1 starts at 3). */
  passSlab: [...[0, 1, 2].map((i) => INDEX[`passSlab3_${i}`]!), ...[0, 1, 2, 3, 4].map((i) => INDEX[`passSlab5_${i}`]!)],
  lampSlab: [...[0, 1, 2].map((i) => INDEX[`lampSlab3_${i}`]!), ...[0, 1, 2, 3, 4].map((i) => INDEX[`lampSlab5_${i}`]!)],
  /** A dessert on its small plate, by dessert (src/data/desserts.ts order). */
  dessertPlate: DESSERTS.map((d) => INDEX[`dessertPlate_${d.id}`]!),
  /** The delivery hub's pieces (src/data/delivery.ts HubPiece order). */
  hub: HUB_SPRITES.map((name) => INDEX[name]!),
  hubRow: SCREEN_ROWS.map((_, i) => INDEX[`hubRow${i}`]!),
  /**
   * The kitchen's rooms (src/render/art/roomArt.ts): their own pieces (RoomItem from ROOM_OWN),
   * walls by style (then the same along y), doors by kind shut and open, the signs.
   */
  room: ROOM_PIECE_SPRITES.map((name) => INDEX[name]!),
  wall: (['X', 'Y'] as const).flatMap((along) => Array.from({ length: WALL_STYLES }, (_, i) => INDEX[`wall${along}${i}`]!)),
  door: [0, 1, 2].map((i) => INDEX[`door${i}`]!),
  doorOpen: [0, 1, 2].map((i) => INDEX[`door${i}Open`]!),
  roomSign: Array.from({ length: SIGN_COUNT }, (_, i) => INDEX[`roomSign${i}`]!),
  /** The restroom (owner M36): a free stall, a shut one, the sink. */
  wc: WC_SPRITES.map((name) => INDEX[name]!),
  /** The bar's pieces (src/data/bar.ts BarPiece order). */
  barDecor: BAR_DECOR_SPRITES.map((name) => INDEX[name]!),
  cooking: DISH_ICONS.map((_, i) => INDEX[`cook${i}`]!),
  /** Station looks by milestone tier. */
  look: {
    stove: looks('stove'),
    sink: looks('sink'),
    fridge: looks('fridge'),
    table: looks('table'),
    tableSquare: looks('tableSquare'),
    tableSmall: looks('tableSmall'),
    tableRound4: looks('tableRound4'),
    tableLongBack: looks('tableLongBack'),
    tableLongMid: looks('tableLongMid'),
    tableLongFront: looks('tableLongFront'),
    tableLong: looks('tableLong'),
    barY: looks('barY'),
    barXBack: looks('barXBack'),
    barCornerBack: looks('barCornerBack'),
    barCornerFront: looks('barCornerFront'),
    barXFront: looks('barXFront'),
    barStool: looks('barStool'),
    booth: looks('booth'),
    boothSeat: looks('boothSeat'),
    boothRest: looks('boothRest'),
    packTable: looks('packTable'),
    chair: looks('chair'),
    chairSeat: looks('chairSeat'),
    chairRest: looks('chairRest'),
    plantPalm: looks('plantPalm'),
    plantBush: looks('plantBush'),
    neonBoard: looks('neonBoard'),
    neonLit: looks('neonLit'),
    streetSign: looks('streetSign'),
    plateSingle: looks('plateSingle'),
    flowers: looks('flowers'),
    floorLamp: looks('floorLamp'),
    aquarium: looks('aquarium'),
    statue: looks('statue'),
    fountain: looks('fountain'),
    piano: looks('piano'),
  },
  /** Sprite index -> its baked golden aura (-1: none). */
  glow: (() => {
    const out = new Array<number>(Object.keys(ALL).length).fill(NONE);
    for (const name of Object.keys(GLOWS)) out[INDEX[name.slice(0, -4)]!] = INDEX[name]!;
    return out;
  })(),
  /** Served dish per dish id, then per milestone tier of its recipe. */
  plate: DISH_PLATES.map((name) => looks(name)),
  /** Char code -> glyph sprite, and its advance width. */
  glyph: (() => {
    const out = new Array<number>(128).fill(NONE);
    for (const ch of GLYPH_CHARS) out[ch.charCodeAt(0)] = INDEX[`glyph_${ch}`]!;
    return out;
  })(),
  advance: (() => {
    const out = new Array<number>(128).fill(6);
    for (const ch of GLYPH_CHARS) out[ch.charCodeAt(0)] = GLYPH_ADVANCE[ch]!;
    return out;
  })(),
};
export type Layers = typeof LAYERS;
