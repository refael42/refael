import { Accessory, Hair, Hat, Outfit, PANTS, SHIRT, type Look } from './looks';

// Celebrities (owner: idea 4, "a famous chef or singer comes in; serve them perfectly and a
// wave of customers follows"). Made-up stars, never real people. Now and then a limo pulls up
// at the curb with the cameras flashing; the star walks straight in (no line) and takes a
// table. Demanding: less patience. Everything they eat costs a fortune; five stars and the
// whole city hears of it (a long buzz of guests), gems, and their sticker on the album's stars
// page. Rules in src/sim/celebs.ts.

export type CelebId = 'chefStar' | 'popStar' | 'footballer' | 'actress' | 'streamer' | 'magician';

export interface CelebDef {
  id: CelebId;
  look: Look;
}

const look = (outfit: Outfit, hair: Hair, hairColor: number, skin: number, shirt: number, pants: number, hat: Hat, accessory: Accessory): Look => ({ outfit, hair, hairColor, skin, shirt, pants, hat, accessory });

export const CELEBS: readonly CelebDef[] = [
  { id: 'chefStar', look: look(Outfit.Chef, Hair.Short, 0, 2, SHIRT.white, PANTS.black, Hat.Toque, Accessory.Sunglasses) },
  { id: 'popStar', look: look(Outfit.Sequin, Hair.Ponytail, 6, 1, SHIRT.pink, PANTS.black, Hat.None, Accessory.Sunglasses) },
  { id: 'footballer', look: look(Outfit.Tracksuit, Hair.Spiky, 0, 4, SHIRT.blue, PANTS.black, Hat.Headband, Accessory.Headphones) },
  { id: 'actress', look: look(Outfit.Suit, Hair.Bob, 3, 0, SHIRT.lavender, PANTS.black, Hat.SunHat, Accessory.Sunglasses) },
  { id: 'streamer', look: look(Outfit.Hoodie, Hair.Curly, 7, 2, SHIRT.mint, PANTS.denim, Hat.Cap, Accessory.Headphones) },
  { id: 'magician', look: look(Outfit.Suit, Hair.Short, 5, 3, SHIRT.charcoal, PANTS.black, Hat.TopHat, Accessory.Monocle) },
];

export const CELEB = {
  /** The first after this many guests; then every this many seconds (sim), at random in the range. */
  minServed: 80,
  every: [600, 900] as readonly [number, number],
  firstAfter: 240,
  /** The limo: seconds driving up to the curb, waiting there, and the star's patience at the door. */
  driveSeconds: 4,
  waitSeconds: 90,
  doorPatience: 40,
  /** Food patience times this: demanding. */
  patience: 0.8,
  /** Their bill times this. */
  price: 6,
  /** Five stars: guests come this much more (the influencer's buzz), for this long; gems. */
  buzzSeconds: 120,
  gems: 5,
  /** Below three stars: the papers say so (rating). */
  badRating: -0.15,
} as const;
