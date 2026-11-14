/**
 * Builds the sprite atlas for a set of content and exposes index lookups.
 * Everything is drawn in code: no image files are downloaded or bundled.
 */
import { BlurStyle, PaintStyle, Skia } from '@shopify/react-native-skia';

import { AIRCRAFT, planeArt } from '../data/aircraft';
import { AIRLINES } from '../data/airlines';
import { ATLAS_SCALE, AtlasBuilder, type Atlas } from './atlas';
import { drawGlyph, GLYPH_CHARS } from './art/glyphs';
import { drawIcon, ICON_NAMES, type IconName } from './art/icons';
import {
  drawBench,
  drawBillboard,
  drawCargoShed,
  drawCone,
  drawCrane,
  drawDesk,
  drawFbo,
  drawFuelPump,
  drawHut,
  drawJetBridge,
  drawKiosk,
  drawFloodMast,
  drawChocks,
  drawSnackCart,
  drawCafe,
  drawFoodShop,
  drawBoardPainted,
  drawLedBoard,
  drawLedTower,
  LED_FRAMES,
  drawPergola,
  drawTowerV,
  drawWeatherStation,
  drawLocalizer,
  drawGlideslope,
  METEO_FRAMES,
  drawRadome,
  drawLamp,
  drawParkSign,
  drawPierSegment,
  drawPlanter,
  drawRock,
  drawScanner,
  drawTaxiSign,
  drawTerminal,
  drawTile,
  drawTower,
  drawTree,
  drawTrolleys,
  drawWindsock,
  drawFuelFarm,
  drawGauge,
  GAUGE_STEPS,
  drawPartsStore,
  drawHangar,
  drawGateBooth,
  drawWarnTriangle,
  drawFireStation,
  drawDebris,
  drawBird,
  drawRedCarpet,
  drawRain,
  drawRadar,
  RADAR_FRAMES,
  IsoPen,
  type TreeKind,
} from './art/objects';
import { drawPerson, OUTFITS, PERSON_BOX, PERSON_FRAMES } from './art/people';
import { BAG_KINDS, BELT_FRAMES, drawBeltBag, drawBeltPiece, drawCarouselBase, drawCarouselIsland } from './art/baggage';
import { drawCharging, drawExchange, drawMassageChairs, drawNursingRoom, drawPharmacy, drawPrayerRoom, drawSleepPods, SwapPen } from './art/amenities';
import { AMENITY_KINDS, type AmenityKind } from '../data/amenities';
import { drawBoulder, drawBoxTruck, drawBush, drawFlowerBed, drawGardenFountain, drawHay, drawLandHotel, drawMall, drawLandSign, drawRentalOffice, drawSchoolHangar, drawShed, drawSolarRow, drawStump, drawTrainer, drawWarehouse } from './art/land';
import { drawHotel, drawPlatformRoof, drawStationHall, drawTunnelPortal } from './art/rail';
import { drawBunting, drawHolidayPiece, drawInfoSign, drawRope, drawStretcher, drawTicketBooth, drawTvCamera } from './art/events';
import {
  drawAtm,
  drawBaggageRoom,
  drawBins,
  drawBoard,
  drawBooth,
  drawBusStop,
  drawCanopy,
  drawCleanCart,
  drawCustomsDesk,
  drawDoorFrame,
  drawFoodStall,
  drawFountain,
  drawGarage,
  drawGateDesk,
  drawInfoDesk,
  drawKidsPlay,
  drawLitter,
  drawGuidePylon,
  drawLostBag,
  drawCordon,
  drawDog,
  DOG_FRAMES,
  drawCameraPole,
  drawDrone,
  DRONE_FRAMES,
  drawPottedPlant,
  drawRental,
  drawRestrooms,
  drawSeats,
  drawSelfCheckin,
  drawShelf,
  drawSculpture,
  drawSign,
  drawSofa,
  drawTable,
  drawTill,
  drawWallPiece,
  WALL_SEG,
  type SignKind,
} from './art/terminal';
import type { FurnitureKind } from '../data/terminals';
import { HOLIDAYS } from '../data/holidays';
import { buildPlane } from './art/plane';
import { drawStack, measureStack, type StackPart } from './art/stack';
import { buildCar, buildVehicle, CAR_VARIANTS, type CarKind, type VehicleKind } from './art/vehicles';

export const DIRS = 16;
export const TREE_KINDS: readonly TreeKind[] = ['round', 'roundDark', 'pine', 'bush', 'birch'];
export const TREE_SIZES = [0.8, 1.0, 1.25] as const;
export const GLYPH_COLORS = ['#ffd23f', '#ffffff', '#ff6b5e'] as const;
export const COIN_FRAMES = 6;
export const VEHICLE_KINDS: readonly VehicleKind[] = ['fuel', 'bags', 'mech', 'tanker', 'partsTruck', 'fire', 'opsCar', 'ambulance', 'limo', 'apronBus', 'apmCar', 'railCar', 'railCab', 'patrol', 'gpu', 'belt', 'catering', 'tug', 'stairs'];
/** Colors of the soft light glows (nav lights, beacons, lamps). */
export const GLOW_COLORS = { red: 0, green: 1, white: 2, amber: 3, blue: 4, pink: 5, purple: 6, gold: 7 } as const;
const GLOW_HEX = ['#ff3b30', '#34d058', '#ffffff', '#ffb020', '#3b82f6', '#ec4899', '#a855f7', '#facc15'];
/** Colours of the action rings: land, fuel, board, take off, bags, and red for one that has waited too long. */
export const ACTION_RING_COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#6366f1', '#a855f7', '#ef4444'] as const;

/** Every color the holiday string lights use (one bulb sprite each). */
export const BULB_COLORS: readonly string[] = [...new Set(HOLIDAYS.flatMap((h) => h.colors))];
/** Rope barrier lengths (tiles) for the historic plane's display: along x, along y. */
export const ROPE_X = 2.0;
export const ROPE_Y = 0.9;
/** Bunting length (tiles, along x) over the terminal front. */
export const BUNTING_LEN = 2.6;

/** Terminal building pieces: wall kinds, piece lengths (quantized), door widths, seat rows. */
export const WALL_KINDS = ['back', 'front', 'glass'] as const;
export const WALL_STEP = 0.05;
const WALL_LENS = Math.round(WALL_SEG / WALL_STEP);
/** Height of the tall back walls. */
export const WALL_H = 0.62;
export const DOOR_WIDTHS = [0.5, 0.8, 1.0, 1.2] as const;
export const SEAT_ROWS = [2, 3, 4, 5, 6] as const;
const PROP_KINDS: readonly FurnitureKind[] = [
  'board',
  'info',
  'wc',
  'bin',
  'atm',
  'water',
  'plant',
  'baggageRoom',
  'signCheckin',
  'signSecurity',
  'signGate',
  'signArrivals',
  'signExit',
  'signBaggage',
  'selfCheckin',
  'booth',
  'till',
  'table',
  'sofa',
  'gateDesk',
  'customsDesk',
  'rental',
  'signDutyFree',
  'signFood',
  'signLounge',
  'signPassport',
  'signCustoms',
  'signTrain',
  'kidsPlay',
  'sculpture',
];
const SIGN_OF: Partial<Record<FurnitureKind, SignKind>> = {
  signCheckin: 'checkin',
  signSecurity: 'security',
  signGate: 'gate',
  signArrivals: 'arrivals',
  signExit: 'exit',
  signBaggage: 'baggage',
  signDutyFree: 'dutyFree',
  signFood: 'food',
  signLounge: 'lounge',
  signPassport: 'passport',
  signCustoms: 'customs',
  signTrain: 'train',
};
/** Looks of litter on the floor. */
export const LITTER_KINDS = 3;
/** The airport hotel is drawn at this size (tiles). */
export const HOTEL_SIZE: readonly [number, number] = [5.0, 3.4];
/** Pieces of the platform roof at the railway station are this long (tiles). */
export const ROOF_SEG = 1.3;
/** Furniture with looks (variant = Furniture.n). */
export const SHELF_VARIANTS = 4;
export const STALL_VARIANTS = 3;
/** The parking garage of Terminal 3 is drawn at this size (tiles). */
export const GARAGE_SIZE: readonly [number, number] = [5.4, 3.4];
const CAR_KINDS: readonly CarKind[] = [...new Set(CAR_VARIANTS.map((c) => c.kind))];

/** Heading in radians -> sprite direction index. */
export function dirIndex(heading: number): number {
  const step = (Math.PI * 2) / DIRS;
  let d = Math.round(heading / step) % DIRS;
  if (d < 0) d += DIRS;
  return d;
}

export interface Content {
  /** [airlineIndex, aircraftIndex] liveries to draw. */
  combos: readonly (readonly [number, number])[];
  /** Airport tier: things only bigger airports have are left out below it (faster to build). Default: all. */
  tier?: number;
}

/** First tier that shows each vehicle kind (supply trucks and the mechanics' van come later). */
const VEHICLE_TIER: Record<VehicleKind, number> = { fuel: 1, bags: 1, tanker: 2, partsTruck: 3, mech: 3, fire: 2, opsCar: 2, ambulance: 2, limo: 2, apronBus: 3, apmCar: 6, railCar: 6, railCab: 6, patrol: 3, gpu: 2, belt: 2, catering: 3, tug: 4, stairs: 3 };

export interface SpriteSet {
  atlas: Atlas;
  tier: number;
  combos: readonly (readonly [number, number])[];
  comboIndex: (airline: number, aircraft: number) => number;
  plane: (combo: number, dir: number) => number;
  planeShadow: (aircraft: number, dir: number) => number;
  person: (outfit: number, back: boolean, mirror: boolean, frame: number) => number;
  vehicle: (kind: number, dir: number) => number;
  vehicleShadow: (kind: number, dir: number) => number;
  /** Private cars (CAR_VARIANTS index) and their shadows. */
  car: (variant: number, dir: number) => number;
  carShadow: (variant: number, dir: number) => number;
  glow: (color: number) => number;
  /** A ring on the ground round a plane that asks for something, in the action's colour (ACTION_RING_COLORS). */
  actionRing: (color: number) => number;
  lamp: number;
  cone: number;
  taxiSign: number;
  parkSign: number;
  trolleys: number;
  planter: (seed: number) => number;
  fbo: number;
  pier: (end: boolean) => number;
  jetBridge: number;
  cargoShed: number;
  /** Supply area: fuel farm by tank count (1..4), its level gauge (0..GAUGE_STEPS), parts store, gate booth. */
  fuelFarm: (tanks: number) => number;
  gauge: (fill: number) => number;
  partsStore: number;
  gateBooth: number;
  /** Hangar with 1 or 2 bays open. */
  hangar: (bays: number) => number;
  warnTriangle: number;
  /** Incidents: fire station, runway debris, a bird (frame 0/1), the VIP carpet, a rain streak. */
  fireStation: number;
  debris: number;
  bird: (frame: number) => number;
  redCarpet: number;
  rain: number;
  /** Terminal building: a wall piece (kind index into WALL_KINDS, length in tiles up to WALL_SEG), door frames, canopies, seat rows, furniture. */
  wallPiece: (kind: number, alongY: boolean, len: number) => number;
  doorFrame: (alongY: boolean, width: number, tall: boolean) => number;
  canopy: (alongY: boolean, width: number) => number;
  seats: (n: number) => number;
  termProp: (kind: FurnitureKind) => number;
  shelf: (variant: number) => number;
  foodStall: (variant: number) => number;
  garage: number;
  busStop: number;
  /** The railway (hub): tunnel portals (west shows its arch), a piece of the platform roof (with or without a post), the entrance pavilion. */
  tunnelPortal: (west: boolean) => number;
  platformRoof: (post: boolean) => number;
  stationHall: number;
  /** The airport hotel (skyport), drawn at HOTEL_SIZE. */
  hotel: number;
  /** Litter on a terminal floor (LITTER_KINDS looks) and the cleaner's trolley. */
  litter: (kind: number) => number;
  cleanCart: number;
  /** Security: an unattended bag and its cordon, the sniffer dog (dir, frame), a camera pole, a drone (frame). */
  lostBag: number;
  /** Baggage: the carousel's base (a frame of its turning plates) and island, a bag lying on a belt, a conveyor piece. */
  carouselBase: (frame: number) => number;
  /** Passenger services in the terminals (facing +x, or +y; the charging pillar alone when slim). */
  amenity: (kind: AmenityKind, faceY: boolean, slim?: boolean) => number;
  /** The land around the airport: obstacles, the sign on a plot for sale, and the facilities' pieces (by level or size). */
  land: {
    bush: number;
    stump: number;
    boulder: number;
    shed: number;
    hay: number;
    sign: number;
    rental: (lv: number) => number;
    solar: number;
    hangar: (lv: number) => number;
    trainer: (k: number) => number;
    warehouse: (size: number) => number;
    truck: (k: number) => number;
    fountain: (frame: number) => number;
    flowers: (k: number) => number;
    hotel: (lv: number) => number;
    mall: (lv: number) => number;
  };
  carouselIsland: number;
  beltBag: (kind: number, alongY: boolean) => number;
  beltPiece: (alongY: boolean, frame: number, forward: boolean) => number;
  cordon: number;
  dog: (dir: number, frame: number) => number;
  cameraPole: number;
  drone: (frame: number) => number;
  /** Events (M11): the stretcher, rope barriers, ticket booth, info sign, TV camera. */
  stretcher: number;
  rope: (alongY: boolean) => number;
  ticketBooth: number;
  infoSign: number;
  tvCamera: number;
  /** The Aviation Guide's pylon with 0..3 gold stars. */
  guidePylon: (stars: number) => number;
  /** Holidays: the centerpiece and bunting of each (HOLIDAYS index), a light bulb by BULB_COLORS index. */
  holidayPiece: (h: number) => number;
  bunting: (h: number) => number;
  bulb: (c: number) => number;
  hut: number;
  pump: number;
  windsock: (dir8: number, frame: number) => number;
  /** Turning radar antenna, frame 0..RADAR_FRAMES-1. */
  radar: (frame: number) => number;
  tree: (kind: number, size: number) => number;
  rock: number;
  icon: (name: IconName) => number;
  glyph: (ch: string, color: number) => number;
  coin: (frame: number) => number;
  puff: number;
  sparkle: number;
  blob: number;
  ring: number;
  kiosk: number;
  billboard: number;
  bench: number;
  /** A floodlight mast over a stand. */
  floodMast: number;
  /** Wheel chocks at a parked plane's nose wheel. */
  chocks: number;
  /** Upgrade versions: the kiosk (1..4), the billboard (1..4, LED frames for 3 and 4), the shaded bench, the tower (1..3), the radome. */
  kioskV: (v: number) => number;
  billboardV: (v: number, frame: number) => number;
  pergola: number;
  towerV: (v: number) => number;
  /** The weather station (frame of the cups; with the dome at level 3). */
  meteo: (frame: number, dome: boolean) => number;
  /** The ILS: the localizer (wide for CAT II/III) and the glideslope (with its monitor; facing +x or -x). */
  localizer: (wide: boolean) => number;
  glideslope: (monitor: boolean, face: number) => number;
  radome: number;
  crane: number;
  terminal: number;
  tower: number;
  tileOk: number;
  tileBad: number;
  desk: number;
  scanner: number;
  /** The security scanner by version (1 X-ray, 2 with a body scanner, 3 a CT scanner too). */
  scannerV: (v: number) => number;
}

function stackSprite(b: AtlasBuilder, parts: (dir: number) => StackPart[], dir: number, silhouette?: string, modelScale = 1): number {
  const heading = (dir / DIRS) * Math.PI * 2;
  const model = parts(dir);
  const sc = ATLAS_SCALE * modelScale;
  const m = measureStack(model, heading, sc);
  return b.add(m.x0 - 4, m.y0 - 4, m.x1 + 4, m.y1 + 4, (c, ox, oy) =>
    drawStack(c, model, heading, ox, oy, { scale: sc, silhouette, outlineWidth: silhouette ? 0 : 2.6 }),
  );
}

/**
 * Atlas resolution of an aircraft relative to ATLAS_SCALE: airliners are stored
 * smaller (they are big on screen anyway) so a whole tier's fleet fits one texture.
 * Draw them with scale 1 / planeRes.
 */
export function planeRes(aircraft: number): number {
  const st = AIRCRAFT[aircraft]?.stand;
  if (st === 'medium') return 0.8;
  if (st === 'large' || st === 'cargo' || st === 'huge' || st === 'hugeX') return 0.62;
  return 1;
}

/** Length of a jet bridge sprite (tiles, along +y from the pier). */
export const BRIDGE_LEN = 2.1;

/** Vehicles are drawn a bit larger than life, like the planes. */
export const VEHICLE_SCALE = 1.3;

export function buildSprites(content: Content): SpriteSet {
  const b = new AtlasBuilder();
  const S = ATLAS_SCALE;

  // planes and their shadows
  const combos = content.combos;
  const planeBase: number[] = [];
  for (const [al, ac] of combos) {
    const first = b.size;
    for (let d = 0; d < DIRS; d++) {
      stackSprite(b, (dir) => buildPlane(planeArt(ac), AIRCRAFT[ac].livery ?? AIRLINES[al].livery, (dir / DIRS) * Math.PI * 2), d, undefined, planeRes(ac));
    }
    planeBase.push(first);
  }
  const shadowBase = new Map<number, number>();
  for (const [, ac] of combos) {
    if (shadowBase.has(ac)) continue;
    const first = b.size;
    for (let d = 0; d < DIRS; d++) {
      stackSprite(b, (dir) => buildPlane(planeArt(ac), AIRLINES[0].livery, (dir / DIRS) * Math.PI * 2), d, '#000000', planeRes(ac));
    }
    shadowBase.set(ac, first);
  }

  // people: outfit x (front/back) x (mirror) x frames
  const personBase = b.size;
  for (let o = 0; o < OUTFITS.length; o++) {
    for (let v = 0; v < 2; v++) {
      for (let m = 0; m < 2; m++) {
        for (let f = 0; f < PERSON_FRAMES; f++) {
          b.add(PERSON_BOX.left * S, PERSON_BOX.top * S, PERSON_BOX.right * S, PERSON_BOX.bottom * S, (c, ox, oy) =>
            drawPerson(c, ox, oy, S, OUTFITS[o], v === 0 ? 'front' : 'back', m === 1, f),
          );
        }
      }
    }
  }

  // vehicles
  const vehicleBase: number[] = [];
  const vehicleShadowBase: number[] = [];
  const tier = content.tier ?? 99;
  for (const kind of VEHICLE_KINDS) {
    if (VEHICLE_TIER[kind] > tier) {
      vehicleBase.push(-1);
      vehicleShadowBase.push(-1);
      continue;
    }
    vehicleBase.push(b.size);
    for (let d = 0; d < DIRS; d++) stackSprite(b, () => buildVehicle(kind), d, undefined, VEHICLE_SCALE);
    vehicleShadowBase.push(b.size);
    for (let d = 0; d < DIRS; d++) stackSprite(b, () => buildVehicle(kind), d, '#000000', VEHICLE_SCALE);
  }

  // private cars: one sprite per variant and direction, shadows per body type
  const carBase: number[] = [];
  for (const v of CAR_VARIANTS) {
    carBase.push(b.size);
    for (let d = 0; d < DIRS; d++) stackSprite(b, () => buildCar(v.kind, v.color), d, undefined, VEHICLE_SCALE);
  }
  const carShadowBase = new Map<CarKind, number>();
  for (const k of CAR_KINDS) {
    carShadowBase.set(k, b.size);
    for (let d = 0; d < DIRS; d++) stackSprite(b, () => buildCar(k, '#000000'), d, '#000000', VEHICLE_SCALE);
  }
  // soft round glows (drawn with transparency on top of everything)
  const glowBase = b.size;
  for (const hex of GLOW_HEX) {
    b.add(-8 * S, -8 * S, 8 * S, 8 * S, (c, ox, oy) => {
      const p = Skia.Paint();
      p.setAntiAlias(true);
      p.setColor(Skia.Color(hex));
      p.setAlphaf(0.45);
      p.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 3 * S, true));
      c.drawCircle(ox, oy, 4.5 * S, p);
      p.setMaskFilter(null);
      p.setAlphaf(1);
      c.drawCircle(ox, oy, 1.7 * S, p);
      p.setColor(Skia.Color('#ffffff'));
      p.setAlphaf(0.8);
      c.drawCircle(ox, oy, 0.8 * S, p);
    });
  }
  const lamp = b.add(-8 * S, -46 * S, 14 * S, 6 * S, (c, ox, oy) => drawLamp(new IsoPen(c, ox, oy, S)));
  const cone = b.add(-6 * S, -10 * S, 6 * S, 5 * S, (c, ox, oy) => drawCone(new IsoPen(c, ox, oy, S)));
  const taxiSign = b.add(-8 * S, -16 * S, 20 * S, 12 * S, (c, ox, oy) => drawTaxiSign(new IsoPen(c, ox, oy, S)));
  const parkSign = b.add(-8 * S, -34 * S, 8 * S, 5 * S, (c, ox, oy) => drawParkSign(new IsoPen(c, ox, oy, S)));
  const trolleys = b.add(-6 * S, -14 * S, 26 * S, 12 * S, (c, ox, oy) => drawTrolleys(new IsoPen(c, ox, oy, S)));
  const planterBase = b.size;
  for (let k = 0; k < 3; k++) b.add(-10 * S, -14 * S, 26 * S, 16 * S, (c, ox, oy) => drawPlanter(new IsoPen(c, ox, oy, S), k * 2));

  // bigger airports (anchor = the footprint's low corner)
  const T = 32 * S;
  const fbo = b.add(-1.6 * T, -1.2 * T, 2.0 * T, 2.0 * T, (c, ox, oy) => drawFbo(new IsoPen(c, ox, oy, S)));
  const pierBase = b.size;
  for (const end of [false, true]) b.add(-1.7 * T, -1.6 * T, 2.4 * T, 2.0 * T, (c, ox, oy) => drawPierSegment(new IsoPen(c, ox, oy, S), end));
  const jetBridge = b.add(-2.2 * T, -0.8 * T, 0.8 * T, 1.6 * T, (c, ox, oy) => drawJetBridge(new IsoPen(c, ox, oy, S), BRIDGE_LEN));
  const cargoShed = b.add(-2.3 * T, -1.8 * T, 3.6 * T, 3.0 * T, (c, ox, oy) => drawCargoShed(new IsoPen(c, ox, oy, S)));
  const farmBase = b.size;
  for (let n = 1; n <= 4; n++) b.add(-2.4 * T, -2.6 * T, 2.4 * T, 1.5 * T, (c, ox, oy) => drawFuelFarm(new IsoPen(c, ox, oy, S), n));
  const gaugeBase = b.size;
  for (let k = 0; k <= GAUGE_STEPS; k++) b.add(-5 * S, -26 * S, 5 * S, 4 * S, (c, ox, oy) => drawGauge(new IsoPen(c, ox, oy, S), k));
  const partsStore = b.add(-2.5 * T, -2.1 * T, 1.9 * T, 1.5 * T, (c, ox, oy) => drawPartsStore(new IsoPen(c, ox, oy, S)));
  const gateBooth = b.add(-1.0 * T, -1.4 * T, 1.2 * T, 0.9 * T, (c, ox, oy) => drawGateBooth(new IsoPen(c, ox, oy, S)));
  const hangarBase = b.size;
  for (let n = 1; n <= 2; n++) b.add(-3.0 * T, -2.3 * T, 6.6 * T, 4.7 * T, (c, ox, oy) => drawHangar(new IsoPen(c, ox, oy, S), n));
  const warnTriangle = b.add(-8 * S, -14 * S, 8 * S, 4 * S, (c, ox, oy) => drawWarnTriangle(new IsoPen(c, ox, oy, S)));
  const fireStation = b.add(-1.6 * T, -1.6 * T, 2.0 * T, 1.7 * T, (c, ox, oy) => drawFireStation(new IsoPen(c, ox, oy, S)));
  const debris = b.add(-10 * S, -6 * S, 10 * S, 8 * S, (c, ox, oy) => drawDebris(new IsoPen(c, ox, oy, S)));
  const birdBase = b.size;
  for (let f = 0; f < 2; f++) b.add(-7 * S, -6 * S, 7 * S, 5 * S, (c, ox, oy) => drawBird(new IsoPen(c, ox, oy, S), f));
  const redCarpet = b.add(-0.4 * T, -1.3 * T, 2.0 * T, 0.3 * T, (c, ox, oy) => drawRedCarpet(new IsoPen(c, ox, oy, S)));
  const rain = b.add(-3 * S, -18 * S, 5 * S, 4 * S, (c, ox, oy) => drawRain(new IsoPen(c, ox, oy, S)));
  // the terminal building
  const wallBase = b.size;
  for (let k = 0; k < WALL_KINDS.length; k++) {
    for (const alongY of [false, true]) {
      for (let n = 1; n <= WALL_LENS; n++) {
        const len = n * WALL_STEP;
        if (alongY) b.add(-(len + 0.2) * T, -0.9 * T, 0.2 * T, (len * 0.5 + 0.3) * T, (c, ox, oy) => drawWallPiece(new IsoPen(c, ox, oy, S), WALL_KINDS[k], true, len, WALL_H));
        else b.add(-0.2 * T, -0.9 * T, (len + 0.2) * T, (len * 0.5 + 0.3) * T, (c, ox, oy) => drawWallPiece(new IsoPen(c, ox, oy, S), WALL_KINDS[k], false, len, WALL_H));
      }
    }
  }
  const doorBase = b.size;
  for (const alongY of [false, true]) {
    for (const wd of DOOR_WIDTHS) {
      for (const tall of [false, true]) {
        if (alongY) b.add(-(wd + 0.2) * T, -0.9 * T, 0.2 * T, (wd * 0.5 + 0.3) * T, (c, ox, oy) => drawDoorFrame(new IsoPen(c, ox, oy, S), true, wd, tall));
        else b.add(-0.2 * T, -0.9 * T, (wd + 0.2) * T, (wd * 0.5 + 0.3) * T, (c, ox, oy) => drawDoorFrame(new IsoPen(c, ox, oy, S), false, wd, tall));
      }
    }
  }
  const canopyBase = b.size;
  for (const alongY of [false, true]) {
    for (const wd of DOOR_WIDTHS) {
      if (alongY) b.add(-(wd + 0.4) * T, -1.0 * T, 1.2 * T, (wd * 0.5 + 0.8) * T, (c, ox, oy) => drawCanopy(new IsoPen(c, ox, oy, S), true, wd + 0.3, 0.7, '#6366f1'));
      else b.add(-0.6 * T, -1.0 * T, (wd + 1.0) * T, (wd * 0.5 + 0.8) * T, (c, ox, oy) => drawCanopy(new IsoPen(c, ox, oy, S), false, wd + 0.3, 0.7, '#6366f1'));
    }
  }
  const seatBase = b.size;
  for (const n of SEAT_ROWS) b.add(-0.3 * T, -0.6 * T, (n * 0.4 + 0.3) * T, (n * 0.2 + 0.5) * T, (c, ox, oy) => drawSeats(new IsoPen(c, ox, oy, S), n));
  const propBase = b.size;
  for (const kind of PROP_KINDS) {
    b.add(-1.1 * T, -1.3 * T, 1.3 * T, 1.1 * T, (c, ox, oy) => {
      const pen = new IsoPen(c, ox, oy, S);
      const sign = SIGN_OF[kind];
      if (sign) return drawSign(pen, sign);
      switch (kind) {
        case 'board':
          return drawBoard(pen);
        case 'info':
          return drawInfoDesk(pen);
        case 'wc':
          return drawRestrooms(pen);
        case 'bin':
          return drawBins(pen);
        case 'atm':
          return drawAtm(pen);
        case 'water':
          return drawFountain(pen);
        case 'plant':
          return drawPottedPlant(pen);
        case 'baggageRoom':
          return drawBaggageRoom(pen);
        case 'selfCheckin':
          return drawSelfCheckin(pen);
        case 'booth':
          return drawBooth(pen);
        case 'till':
          return drawTill(pen);
        case 'table':
          return drawTable(pen);
        case 'sofa':
          return drawSofa(pen);
        case 'gateDesk':
          return drawGateDesk(pen);
        case 'customsDesk':
          return drawCustomsDesk(pen);
        case 'rental':
          return drawRental(pen);
        case 'kidsPlay':
          return drawKidsPlay(pen);
        case 'sculpture':
          return drawSculpture(pen);
      }
    });
  }
  const shelfBase = b.size;
  for (let k = 0; k < SHELF_VARIANTS; k++) b.add(-0.3 * T, -0.8 * T, 1.0 * T, 0.7 * T, (c, ox, oy) => drawShelf(new IsoPen(c, ox, oy, S), k));
  const stallBase = b.size;
  for (let k = 0; k < STALL_VARIANTS; k++) b.add(-0.3 * T, -1.0 * T, 1.1 * T, 0.8 * T, (c, ox, oy) => drawFoodStall(new IsoPen(c, ox, oy, S), k));
  const garage = b.add(-(GARAGE_SIZE[1] + 0.5) * T, -1.8 * T, (GARAGE_SIZE[0] + 0.5) * T, ((GARAGE_SIZE[0] + GARAGE_SIZE[1]) * 0.5 + 0.5) * T, (c, ox, oy) => drawGarage(new IsoPen(c, ox, oy, S), GARAGE_SIZE[0], GARAGE_SIZE[1]));
  const busStop = b.add(-0.4 * T, -0.8 * T, 1.2 * T, 0.8 * T, (c, ox, oy) => drawBusStop(new IsoPen(c, ox, oy, S)));
  const portals = [true, false].map((west) => b.add(-2.0 * T, -1.6 * T, 2.0 * T, 1.6 * T, (c, ox, oy) => drawTunnelPortal(new IsoPen(c, ox, oy, S), west)));
  const roofs = [true, false].map((post) => b.add(-0.6 * T, -1.2 * T, (ROOF_SEG + 0.6) * T, (ROOF_SEG * 0.5 + 0.8) * T, (c, ox, oy) => drawPlatformRoof(new IsoPen(c, ox, oy, S), ROOF_SEG, post)));
  const litterBase = b.size;
  for (let k = 0; k < LITTER_KINDS; k++) b.add(-0.18 * T, -0.22 * T, 0.18 * T, 0.14 * T, (c, ox, oy) => drawLitter(new IsoPen(c, ox, oy, S), k));
  const cleanCart = b.add(-0.3 * T, -0.6 * T, 0.3 * T, 0.25 * T, (c, ox, oy) => drawCleanCart(new IsoPen(c, ox, oy, S)));
  const P = (draw: (p: IsoPen) => void) => (c: Parameters<Parameters<typeof b.add>[4]>[0], ox: number, oy: number) => draw(new IsoPen(c, ox, oy, S));
  const landBush = b.add(-13 * S, -20 * S, 13 * S, 7 * S, P(drawBush));
  const landStump = b.add(-11 * S, -10 * S, 11 * S, 9 * S, P(drawStump));
  const landBoulder = b.add(-17 * S, -16 * S, 17 * S, 11 * S, P(drawBoulder));
  const landShed = b.add(-19 * S, -26 * S, 19 * S, 13 * S, P(drawShed));
  const landHay = b.add(-17 * S, -16 * S, 17 * S, 11 * S, P(drawHay));
  const landSign = b.add(-10 * S, -20 * S, 10 * S, 7 * S, P(drawLandSign));
  const rentalAt = b.size;
  for (let lv = 1; lv <= 5; lv++) b.add(-33 * S, -38 * S, 33 * S, 19 * S, P((p) => drawRentalOffice(p, lv)));
  const landSolar = b.add(-9 * S, -15 * S, 63 * S, 33 * S, P(drawSolarRow));
  const hangarAt = b.size;
  for (let lv = 1; lv <= 5; lv++) b.add(-43 * S, -43 * S, 43 * S, 23 * S, P((p) => drawSchoolHangar(p, lv)));
  const trainerAt = b.size;
  for (const col of ['#ef4444', '#2563eb', '#f59e0b']) b.add(-23 * S, -15 * S, 23 * S, 13 * S, P((p) => drawTrainer(p, col)));
  const warehouseAt = b.size;
  for (let size = 1; size <= 3; size++) b.add(-57 * S, -51 * S, 57 * S, 31 * S, P((p) => drawWarehouse(p, size)));
  const truckAt = b.size;
  for (const col of ['#0ea5e9', '#16a34a']) b.add(-15 * S, -15 * S, 15 * S, 11 * S, P((p) => drawBoxTruck(p, col)));
  const fountainAt = b.size;
  for (let f = 0; f < 2; f++) b.add(-23 * S, -27 * S, 23 * S, 15 * S, P((p) => drawGardenFountain(p, f)));
  const flowersAt = b.size;
  for (let k = 0; k < 3; k++) b.add(-15 * S, -11 * S, 15 * S, 11 * S, P((p) => drawFlowerBed(p, k)));
  const amenityAt = b.size;
  const amenityDraw: Record<AmenityKind, (p: IsoPen) => void> = {
    charging: (p) => drawCharging(p),
    exchange: drawExchange,
    pharmacy: drawPharmacy,
    massage: drawMassageChairs,
    pods: drawSleepPods,
    prayer: drawPrayerRoom,
    nursing: drawNursingRoom,
  };
  for (const kind of AMENITY_KINDS) {
    for (const faceY of [false, true]) {
      b.add(-36 * S, -34 * S, 36 * S, 34 * S, (c, ox, oy) => amenityDraw[kind](faceY ? new SwapPen(c, ox, oy, S) : new IsoPen(c, ox, oy, S)));
    }
  }
  const slimCharger = b.add(-12 * S, -30 * S, 12 * S, 12 * S, (c, ox, oy) => drawCharging(new IsoPen(c, ox, oy, S), false));
  const landHotelAt = b.size;
  for (let lv = 1; lv <= 5; lv++) b.add(-44 * S, -(40 + (lv + 1) * 9) * S - 20 * S, 44 * S, 30 * S, P((p) => drawLandHotel(p, lv + 1)));
  const mallAt = b.size;
  for (let lv = 1; lv <= 5; lv++) b.add(-(60 + lv * 9) * S, -48 * S, (60 + lv * 9) * S, 44 * S, P((p) => drawMall(p, lv)));
  const carouselBaseAt = b.size;
  for (let f = 0; f < BELT_FRAMES; f++) b.add(-28 * S, -20 * S, 28 * S, 18 * S, (c, ox, oy) => drawCarouselBase(new IsoPen(c, ox, oy, S), f));
  const carouselIsland = b.add(-16 * S, -28 * S, 16 * S, 10 * S, (c, ox, oy) => drawCarouselIsland(new IsoPen(c, ox, oy, S)));
  const beltBagAt = b.size;
  for (let k = 0; k < BAG_KINDS; k++) for (const alongY of [false, true]) b.add(-11 * S, -10 * S, 11 * S, 9 * S, (c, ox, oy) => drawBeltBag(new IsoPen(c, ox, oy, S), k, alongY));
  const beltPieceAt = b.size;
  for (const alongY of [false, true]) for (const forward of [false, true]) for (let f = 0; f < BELT_FRAMES; f++) b.add(-16 * S, -12 * S, 16 * S, 11 * S, (c, ox, oy) => drawBeltPiece(new IsoPen(c, ox, oy, S), alongY, f, forward));
  const lostBag = b.add(-0.15 * T, -0.4 * T, 0.15 * T, 0.12 * T, (c, ox, oy) => drawLostBag(new IsoPen(c, ox, oy, S)));
  const cordon = b.add(-0.65 * T, -0.75 * T, 0.65 * T, 0.45 * T, (c, ox, oy) => drawCordon(new IsoPen(c, ox, oy, S)));
  const dogBase = b.size;
  for (let d = 0; d < 8; d++) for (let f = 0; f < DOG_FRAMES; f++) b.add(-0.25 * T, -0.35 * T, 0.25 * T, 0.18 * T, (c, ox, oy) => drawDog(new IsoPen(c, ox, oy, S), d, f));
  const cameraPole = b.add(-0.15 * T, -1.25 * T, 0.3 * T, 0.12 * T, (c, ox, oy) => drawCameraPole(new IsoPen(c, ox, oy, S)));
  const droneBase = b.size;
  for (let f = 0; f < DRONE_FRAMES; f++) b.add(-0.3 * T, -0.25 * T, 0.3 * T, 0.2 * T, (c, ox, oy) => drawDrone(new IsoPen(c, ox, oy, S), f));
  const stationHall = b.add(-1.0 * T, -1.3 * T, 1.8 * T, 1.4 * T, (c, ox, oy) => drawStationHall(new IsoPen(c, ox, oy, S)));
  const hotel =
    tier >= 8
      ? b.add(-(HOTEL_SIZE[1] + 0.6) * T, -3.4 * T, (HOTEL_SIZE[0] + 0.6) * T, ((HOTEL_SIZE[0] + HOTEL_SIZE[1]) * 0.5 + 0.8) * T, (c, ox, oy) => drawHotel(new IsoPen(c, ox, oy, S), HOTEL_SIZE[0], HOTEL_SIZE[1]))
      : stationHall;
  const stretcher = b.add(-14 * S, -12 * S, 14 * S, 8 * S, (c, ox, oy) => drawStretcher(new IsoPen(c, ox, oy, S)));
  const ropeX = b.add(-0.2 * T, -0.5 * T, (ROPE_X + 0.2) * T, (ROPE_X * 0.5 + 0.3) * T, (c, ox, oy) => drawRope(new IsoPen(c, ox, oy, S), ROPE_X, false));
  const ropeY = b.add(-(ROPE_Y + 0.2) * T, -0.5 * T, 0.2 * T, (ROPE_Y * 0.5 + 0.3) * T, (c, ox, oy) => drawRope(new IsoPen(c, ox, oy, S), ROPE_Y, true));
  const ticketBooth = b.add(-0.6 * T, -0.9 * T, 0.8 * T, 0.7 * T, (c, ox, oy) => drawTicketBooth(new IsoPen(c, ox, oy, S)));
  const infoSign = b.add(-0.3 * T, -0.8 * T, 0.6 * T, 0.5 * T, (c, ox, oy) => drawInfoSign(new IsoPen(c, ox, oy, S)));
  const tvCamera = b.add(-0.3 * T, -0.6 * T, 0.3 * T, 0.3 * T, (c, ox, oy) => drawTvCamera(new IsoPen(c, ox, oy, S)));
  const pylonBase = b.size;
  for (let k = 0; k <= 3; k++) b.add(-0.45 * T, -1.25 * T, 0.45 * T, 0.35 * T, (c, ox, oy) => drawGuidePylon(new IsoPen(c, ox, oy, S), k));
  const holidayBase = b.size;
  for (const h of HOLIDAYS) b.add(-1.2 * T, -1.6 * T, 1.4 * T, 0.9 * T, (c, ox, oy) => drawHolidayPiece(new IsoPen(c, ox, oy, S), h.id));
  const buntingBase = b.size;
  for (const h of HOLIDAYS) b.add(-0.2 * T, -0.4 * T, (BUNTING_LEN + 0.2) * T, (BUNTING_LEN * 0.5 + 0.3) * T, (c, ox, oy) => drawBunting(new IsoPen(c, ox, oy, S), BUNTING_LEN, h.colors));
  const bulbBase = b.size;
  for (const hex of BULB_COLORS) {
    b.add(-3 * S, -3 * S, 3 * S, 3 * S, (c, ox, oy) => {
      const p = Skia.Paint();
      p.setAntiAlias(true);
      p.setColor(Skia.Color('#334155'));
      c.drawCircle(ox, oy, 1.7 * S, p);
      p.setColor(Skia.Color(hex));
      c.drawCircle(ox, oy, 1.3 * S, p);
      p.setColor(Skia.Color('#ffffff'));
      p.setAlphaf(0.7);
      c.drawCircle(ox - 0.4 * S, oy - 0.4 * S, 0.45 * S, p);
    });
  }

  // static objects (anchor = object origin on the ground)
  const hut = b.add(-1.9 * 32 * S, -1.6 * 32 * S, 2.2 * 32 * S, 2.0 * 32 * S, (c, ox, oy) => drawHut(new IsoPen(c, ox, oy, S)));
  const pump = b.add(-0.9 * 32 * S, -0.9 * 32 * S, 1.0 * 32 * S, 0.9 * 32 * S, (c, ox, oy) => drawFuelPump(new IsoPen(c, ox, oy, S)));
  const sockBase = b.size;
  for (let d = 0; d < 8; d++) {
    for (let f = 0; f < 2; f++) {
      b.add(-26 * S, -52 * S, 26 * S, 10 * S, (c, ox, oy) => drawWindsock(new IsoPen(c, ox, oy, S), d, f));
    }
  }
  const radarBase = b.size;
  for (let f = 0; f < RADAR_FRAMES; f++) b.add(-24 * S, -66 * S, 24 * S, 10 * S, (c, ox, oy) => drawRadar(new IsoPen(c, ox, oy, S), f));
  const treeBase = b.size;
  for (const kind of TREE_KINDS) {
    for (const size of TREE_SIZES) {
      const r = 34 * size * S;
      b.add(-r, -86 * size * S, r, 12 * size * S, (c, ox, oy) => drawTree(new IsoPen(c, ox, oy, S), kind, size));
    }
  }
  const rock = b.add(-12 * S, -10 * S, 12 * S, 8 * S, (c, ox, oy) => drawRock(new IsoPen(c, ox, oy, S), 1.2));
  const kiosk = b.add(-34 * S, -40 * S, 50 * S, 40 * S, (c, ox, oy) => drawKiosk(new IsoPen(c, ox, oy, S)));
  const billboard = b.add(-10 * S, -54 * S, 44 * S, 28 * S, (c, ox, oy) => drawBillboard(new IsoPen(c, ox, oy, S)));
  const bench = b.add(-20 * S, -36 * S, 30 * S, 22 * S, (c, ox, oy) => drawBench(new IsoPen(c, ox, oy, S)));
  // upgrade versions
  const floodMast = b.add(-0.25 * T, -2.5 * T, 0.25 * T, 0.12 * T, (c, ox, oy) => drawFloodMast(new IsoPen(c, ox, oy, S)));
  const chocks = b.add(-0.12 * T, -0.1 * T, 0.12 * T, 0.08 * T, (c, ox, oy) => drawChocks(new IsoPen(c, ox, oy, S)));
  const cart = b.add(-26 * S, -40 * S, 34 * S, 30 * S, (c, ox, oy) => drawSnackCart(new IsoPen(c, ox, oy, S)));
  const cafe = b.add(-34 * S, -40 * S, 82 * S, 56 * S, (c, ox, oy) => drawCafe(new IsoPen(c, ox, oy, S)));
  const shop = b.add(-40 * S, -50 * S, 60 * S, 48 * S, (c, ox, oy) => drawFoodShop(new IsoPen(c, ox, oy, S)));
  const painted = b.add(-8 * S, -40 * S, 36 * S, 24 * S, (c, ox, oy) => drawBoardPainted(new IsoPen(c, ox, oy, S)));
  const ledBase = b.size;
  for (let f = 0; f < LED_FRAMES; f++) b.add(-12 * S, -56 * S, 46 * S, 30 * S, (c, ox, oy) => drawLedBoard(new IsoPen(c, ox, oy, S), f));
  const ledTowerBase = b.size;
  for (let f = 0; f < LED_FRAMES; f++) b.add(-14 * S, -84 * S, 48 * S, 30 * S, (c, ox, oy) => drawLedTower(new IsoPen(c, ox, oy, S), f));
  const pergola = b.add(-26 * S, -44 * S, 40 * S, 30 * S, (c, ox, oy) => drawPergola(new IsoPen(c, ox, oy, S)));
  const tower2 = b.add(-22 * S, -128 * S, 24 * S, 18 * S, (c, ox, oy) => drawTowerV(new IsoPen(c, ox, oy, S), 2));
  const tower3 = b.add(-24 * S, -150 * S, 26 * S, 20 * S, (c, ox, oy) => drawTowerV(new IsoPen(c, ox, oy, S), 3));
  const tower4 = b.add(-34 * S, -186 * S, 36 * S, 26 * S, (c, ox, oy) => drawTowerV(new IsoPen(c, ox, oy, S), 4));
  const locBase = b.size;
  for (const wide of [false, true]) b.add(-40 * S, -36 * S, 40 * S, 40 * S, (c, ox, oy) => drawLocalizer(new IsoPen(c, ox, oy, S), wide));
  const gsBase = b.size;
  for (const monitor of [false, true]) for (const face of [1, -1]) b.add(-40 * S, -54 * S, 40 * S, 24 * S, (c, ox, oy) => drawGlideslope(new IsoPen(c, ox, oy, S), monitor, face));
  const meteoBase = b.size;
  for (const dome of [false, true]) for (let f = 0; f < METEO_FRAMES; f++) b.add(-34 * S, -34 * S, 34 * S, 36 * S, (c, ox, oy) => drawWeatherStation(new IsoPen(c, ox, oy, S), f, dome));
  const radome = b.add(-24 * S, -60 * S, 24 * S, 12 * S, (c, ox, oy) => drawRadome(new IsoPen(c, ox, oy, S)));
  const terminal = b.add(-2.2 * 32 * S, -2.0 * 32 * S, 3.0 * 32 * S, 2.6 * 32 * S, (c, ox, oy) => drawTerminal(new IsoPen(c, ox, oy, S)));
  const tower = b.add(-16 * S, -100 * S, 18 * S, 14 * S, (c, ox, oy) => drawTower(new IsoPen(c, ox, oy, S)));
  const tileOk = b.add(-34 * S, -18 * S, 34 * S, 18 * S, (c, ox, oy) => drawTile(new IsoPen(c, ox, oy, S), 'rgba(16,185,129,0.55)'));
  const tileBad = b.add(-34 * S, -18 * S, 34 * S, 18 * S, (c, ox, oy) => drawTile(new IsoPen(c, ox, oy, S), 'rgba(239,68,68,0.55)'));
  const desk = b.add(-14 * S, -34 * S, 26 * S, 16 * S, (c, ox, oy) => drawDesk(new IsoPen(c, ox, oy, S)));
  const scanner = b.add(-18 * S, -34 * S, 40 * S, 18 * S, (c, ox, oy) => drawScanner(new IsoPen(c, ox, oy, S)));
  const scanner2 = b.add(-34 * S, -36 * S, 40 * S, 20 * S, (c, ox, oy) => drawScanner(new IsoPen(c, ox, oy, S), 2));
  const scanner3 = b.add(-34 * S, -36 * S, 46 * S, 22 * S, (c, ox, oy) => drawScanner(new IsoPen(c, ox, oy, S), 3));
  const crane = b.add(-40 * S, -80 * S, 50 * S, 24 * S, (c, ox, oy) => drawCrane(new IsoPen(c, ox, oy, S)));

  // world icons, drawn centered on the anchor
  const iconBase = b.size;
  const ICON_PX = 30 * S;
  for (const name of ICON_NAMES) {
    b.add(-ICON_PX / 2, -ICON_PX / 2, ICON_PX / 2, ICON_PX / 2, (c, ox, oy) => drawIcon(c, name, ox - ICON_PX / 2, oy - ICON_PX / 2, ICON_PX));
  }

  // glyphs (anchor = top-left)
  const glyphBase = b.size;
  const GU = 1.5 * S; // pixels per glyph unit
  for (const ch of GLYPH_CHARS) {
    for (const col of GLYPH_COLORS) {
      b.add(-3 * GU, -3 * GU, 9 * GU, 13 * GU, (c, ox, oy) => drawGlyph(c, ch, ox, oy, GU, col));
    }
  }

  // effects
  const coinBase = b.size;
  for (let f = 0; f < COIN_FRAMES; f++) {
    const sx = Math.max(0.15, Math.abs(Math.cos((f / COIN_FRAMES) * Math.PI)));
    b.add(-9 * S, -9 * S, 9 * S, 9 * S, (c, ox, oy) => {
      c.save();
      c.translate(ox, oy);
      c.scale(sx, 1);
      drawIcon(c, 'coin', -8 * S, -8 * S, 16 * S);
      c.restore();
    });
  }
  const puff = b.add(-10 * S, -10 * S, 10 * S, 10 * S, (c, ox, oy) => {
    const p = Skia.Paint();
    p.setAntiAlias(true);
    p.setStyle(PaintStyle.Fill);
    p.setColor(Skia.Color('rgba(214,190,150,0.55)'));
    c.drawCircle(ox, oy, 8 * S, p);
    p.setColor(Skia.Color('rgba(240,225,195,0.6)'));
    c.drawCircle(ox - 2 * S, oy - 2 * S, 4.5 * S, p);
  });
  const sparkle = b.add(-8 * S, -8 * S, 8 * S, 8 * S, (c, ox, oy) => {
    const p = Skia.Paint();
    p.setAntiAlias(true);
    p.setColor(Skia.Color('#fff6c2'));
    const pb = Skia.PathBuilder.Make();
    const r = 7 * S;
    const q = 1.6 * S;
    pb.moveTo(ox, oy - r);
    pb.lineTo(ox + q, oy - q);
    pb.lineTo(ox + r, oy);
    pb.lineTo(ox + q, oy + q);
    pb.lineTo(ox, oy + r);
    pb.lineTo(ox - q, oy + q);
    pb.lineTo(ox - r, oy);
    pb.lineTo(ox - q, oy - q);
    pb.close();
    c.drawPath(pb.build(), p);
  });
  const blob = b.add(-16 * S, -8 * S, 16 * S, 8 * S, (c, ox, oy) => {
    const p = Skia.Paint();
    p.setAntiAlias(true);
    p.setColor(Skia.Color('#000000'));
    c.drawOval(Skia.XYWHRect(ox - 15 * S, oy - 7 * S, 30 * S, 14 * S), p);
  });

  const ring = b.add(-40 * S, -22 * S, 40 * S, 22 * S, (c, ox, oy) => {
    const p = Skia.Paint();
    p.setAntiAlias(true);
    p.setStyle(PaintStyle.Stroke);
    p.setStrokeWidth(6 * S);
    p.setColor(Skia.Color('rgba(255,255,255,0.7)'));
    p.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 3 * S, true));
    c.drawOval(Skia.XYWHRect(ox - 36 * S, oy - 18 * S, 72 * S, 36 * S), p);
    p.setMaskFilter(null);
    p.setStrokeWidth(2.2 * S);
    p.setColor(Skia.Color('#ffffff'));
    c.drawOval(Skia.XYWHRect(ox - 36 * S, oy - 18 * S, 72 * S, 36 * S), p);
  });

  const actionRingAt = b.size;
  for (const hex of ACTION_RING_COLORS) {
    b.add(-40 * S, -22 * S, 40 * S, 22 * S, (c, ox, oy) => {
      const p = Skia.Paint();
      p.setAntiAlias(true);
      // a soft wide glow, then a crisp ring with a white edge
      p.setStyle(PaintStyle.Stroke);
      p.setStrokeWidth(7 * S);
      p.setColor(Skia.Color(hex));
      p.setAlphaf(0.45);
      p.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, 3.5 * S, true));
      c.drawOval(Skia.XYWHRect(ox - 35 * S, oy - 17.5 * S, 70 * S, 35 * S), p);
      p.setMaskFilter(null);
      p.setAlphaf(1);
      p.setStrokeWidth(3.2 * S);
      c.drawOval(Skia.XYWHRect(ox - 35 * S, oy - 17.5 * S, 70 * S, 35 * S), p);
      p.setStrokeWidth(1 * S);
      p.setColor(Skia.Color('rgba(255,255,255,0.85)'));
      c.drawOval(Skia.XYWHRect(ox - 33 * S, oy - 16.5 * S, 66 * S, 33 * S), p);
    });
  }

  // a big fleet needs a wider sheet (keeps the texture's height in check)
  const atlas = b.build(content.combos.length > 10 ? 4096 : 2048);
  const glyphIndex = new Map<string, number>();
  GLYPH_CHARS.forEach((ch, i) => glyphIndex.set(ch, i));
  const iconIndex = new Map<string, number>();
  ICON_NAMES.forEach((n, i) => iconIndex.set(n, i));

  return {
    tier,
    atlas,
    combos,
    // a livery that is not in this atlas falls back to the same aircraft in other colors
    comboIndex: (al, ac) => {
      const i = combos.findIndex(([a, c]) => a === al && c === ac);
      return i >= 0 ? i : combos.findIndex(([, c]) => c === ac);
    },
    plane: (combo, dir) => planeBase[combo] + dir,
    planeShadow: (ac, dir) => (shadowBase.get(ac) ?? 0) + dir,
    person: (o, back, mirror, frame) => personBase + ((o * 2 + (back ? 1 : 0)) * 2 + (mirror ? 1 : 0)) * PERSON_FRAMES + frame,
    vehicle: (k, d) => (vehicleBase[k] >= 0 ? vehicleBase[k] : vehicleBase[0]) + d,
    vehicleShadow: (k, d) => (vehicleShadowBase[k] >= 0 ? vehicleShadowBase[k] : vehicleShadowBase[0]) + d,
    car: (v, d) => carBase[v] + d,
    carShadow: (v, d) => (carShadowBase.get(CAR_VARIANTS[v]?.kind ?? 'sedan') ?? 0) + d,
    glow: (c) => glowBase + c,
    actionRing: (c) => actionRingAt + Math.max(0, Math.min(ACTION_RING_COLORS.length - 1, c)),
    lamp,
    cone,
    taxiSign,
    parkSign,
    trolleys,
    planter: (k) => planterBase + (k % 3),
    fbo,
    pier: (end) => pierBase + (end ? 1 : 0),
    jetBridge,
    cargoShed,
    fuelFarm: (n) => farmBase + Math.max(0, Math.min(3, n - 1)),
    gauge: (k) => gaugeBase + Math.max(0, Math.min(GAUGE_STEPS, Math.round(k))),
    partsStore,
    gateBooth,
    hangar: (n) => hangarBase + (n >= 2 ? 1 : 0),
    warnTriangle,
    fireStation,
    debris,
    bird: (f) => birdBase + (f % 2),
    redCarpet,
    rain,
    wallPiece: (kind, alongY, len) => wallBase + (kind * 2 + (alongY ? 1 : 0)) * WALL_LENS + Math.max(0, Math.min(WALL_LENS - 1, Math.round(len / WALL_STEP) - 1)),
    doorFrame: (alongY, width, tall) => {
      const w = DOOR_WIDTHS.reduce((best, d, i) => (Math.abs(d - width) < Math.abs(DOOR_WIDTHS[best] - width) ? i : best), 0);
      return doorBase + ((alongY ? 1 : 0) * DOOR_WIDTHS.length + w) * 2 + (tall ? 1 : 0);
    },
    canopy: (alongY, width) => {
      const w = DOOR_WIDTHS.reduce((best, d, i) => (Math.abs(d - width) < Math.abs(DOOR_WIDTHS[best] - width) ? i : best), 0);
      return canopyBase + (alongY ? 1 : 0) * DOOR_WIDTHS.length + w;
    },
    seats: (n) => seatBase + Math.max(0, SEAT_ROWS.indexOf(n as (typeof SEAT_ROWS)[number])),
    termProp: (kind) => propBase + Math.max(0, PROP_KINDS.indexOf(kind)),
    shelf: (v) => shelfBase + (((v % SHELF_VARIANTS) + SHELF_VARIANTS) % SHELF_VARIANTS),
    foodStall: (v) => stallBase + (((v % STALL_VARIANTS) + STALL_VARIANTS) % STALL_VARIANTS),
    garage,
    busStop,
    tunnelPortal: (west) => portals[west ? 0 : 1],
    platformRoof: (post) => roofs[post ? 0 : 1],
    stationHall,
    hotel,
    litter: (k) => litterBase + (k % LITTER_KINDS),
    cleanCart,
    lostBag,
    land: {
      bush: landBush,
      stump: landStump,
      boulder: landBoulder,
      shed: landShed,
      hay: landHay,
      sign: landSign,
      rental: (lv) => rentalAt + Math.max(0, Math.min(4, lv - 1)),
      solar: landSolar,
      hangar: (lv) => hangarAt + Math.max(0, Math.min(4, lv - 1)),
      trainer: (k) => trainerAt + (((k % 3) + 3) % 3),
      warehouse: (size) => warehouseAt + Math.max(0, Math.min(2, size - 1)),
      truck: (k) => truckAt + (((k % 2) + 2) % 2),
      fountain: (f) => fountainAt + (((f % 2) + 2) % 2),
      flowers: (k) => flowersAt + (((k % 3) + 3) % 3),
      hotel: (lv) => landHotelAt + Math.max(0, Math.min(4, lv - 1)),
      mall: (lv) => mallAt + Math.max(0, Math.min(4, lv - 1)),
    },
    amenity: (kind, faceY, slim) => (slim && kind === 'charging' ? slimCharger : amenityAt + AMENITY_KINDS.indexOf(kind) * 2 + (faceY ? 1 : 0)),
    carouselBase: (f) => carouselBaseAt + (((f % BELT_FRAMES) + BELT_FRAMES) % BELT_FRAMES),
    carouselIsland,
    beltBag: (k, alongY) => beltBagAt + (((k % BAG_KINDS) + BAG_KINDS) % BAG_KINDS) * 2 + (alongY ? 1 : 0),
    beltPiece: (alongY, f, forward) => beltPieceAt + ((alongY ? 2 : 0) + (forward ? 1 : 0)) * BELT_FRAMES + (((f % BELT_FRAMES) + BELT_FRAMES) % BELT_FRAMES),
    cordon,
    dog: (d, f) => dogBase + (((d % 8) + 8) % 8) * DOG_FRAMES + (f % DOG_FRAMES),
    cameraPole,
    drone: (f) => droneBase + (f % DRONE_FRAMES),
    stretcher,
    rope: (alongY) => (alongY ? ropeY : ropeX),
    ticketBooth,
    infoSign,
    tvCamera,
    guidePylon: (k) => pylonBase + Math.max(0, Math.min(3, k)),
    holidayPiece: (h) => holidayBase + h,
    bunting: (h) => buntingBase + h,
    bulb: (c) => bulbBase + c,
    hut,
    pump,
    windsock: (d, f) => sockBase + d * 2 + f,
    radar: (f) => radarBase + (((f % RADAR_FRAMES) + RADAR_FRAMES) % RADAR_FRAMES),
    tree: (k, s) => treeBase + k * TREE_SIZES.length + s,
    rock,
    icon: (n) => iconBase + (iconIndex.get(n) ?? 0),
    glyph: (ch, col) => glyphBase + (glyphIndex.get(ch) ?? 0) * GLYPH_COLORS.length + col,
    coin: (f) => coinBase + (f % COIN_FRAMES),
    puff,
    sparkle,
    blob,
    ring,
    kiosk,
    billboard,
    bench,
    chocks,
    floodMast,
    kioskV: (v) => (v <= 1 ? cart : v === 2 ? kiosk : v === 3 ? cafe : shop),
    billboardV: (v, f) => (v <= 1 ? painted : v === 2 ? billboard : (v === 3 ? ledBase : ledTowerBase) + (((f % LED_FRAMES) + LED_FRAMES) % LED_FRAMES)),
    pergola,
    towerV: (v) => (v <= 1 ? tower : v === 2 ? tower2 : v === 3 ? tower3 : tower4),
    localizer: (wide) => locBase + (wide ? 1 : 0),
    glideslope: (monitor, face) => gsBase + (monitor ? 2 : 0) + (face > 0 ? 0 : 1),
    meteo: (f, dome) => meteoBase + (dome ? METEO_FRAMES : 0) + (((f % METEO_FRAMES) + METEO_FRAMES) % METEO_FRAMES),
    radome,
    crane,
    terminal,
    tower,
    tileOk,
    tileBad,
    desk,
    scanner,
    scannerV: (v) => (v >= 3 ? scanner3 : v === 2 ? scanner2 : scanner),
  };
}

/** A small PNG sheet of icons for the React Native UI (data URI). */
export interface UiIconSheet {
  uri: string;
  cell: number;
  cols: number;
  width: number;
  height: number;
  index: (name: IconName) => number;
}

export function buildUiIcons(cell = 96): UiIconSheet {
  const cols = 8;
  const rows = Math.ceil(ICON_NAMES.length / cols);
  const surface = Skia.Surface.Make(cols * cell, rows * cell);
  if (!surface) throw new Error('Could not create the icon surface');
  const c = surface.getCanvas();
  c.clear(Skia.Color('transparent'));
  ICON_NAMES.forEach((n, i) => drawIcon(c, n, (i % cols) * cell + cell * 0.06, Math.floor(i / cols) * cell + cell * 0.06, cell * 0.88));
  surface.flush();
  const img = surface.makeImageSnapshot();
  const uri = 'data:image/png;base64,' + img.encodeToBase64();
  img.dispose();
  surface.dispose();
  const map = new Map<string, number>();
  ICON_NAMES.forEach((n, i) => map.set(n, i));
  return { uri, cell, cols, width: cols * cell, height: rows * cell, index: (n) => map.get(n) ?? 0 };
}
