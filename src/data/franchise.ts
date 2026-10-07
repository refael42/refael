// Opening a branch in a new city (prestige, M12). From the grand restaurant on, the manager can
// hand this restaurant over and start again in the next city with an empty diner. What carries
// over: gems, everything bought "forever" in the shop, the names, and chef trophies. Trophies
// come from what this branch earned (more, but less and less more, the further it got) and
// every one of them makes every dish sell for more in every branch after it.

export const FRANCHISE = {
  /** A branch opens from this building on (the grand restaurant). */
  minBuilding: 2,
  /** Trophies for a branch: perDecade for every power of ten of coins earned past 10^fromLog. */
  perDecade: 2,
  fromLog: 7.5,
  /** Every trophy: all prices +25 %, for good. */
  pricePerTrophy: 0.25,
};

/** The cities, in the order the branches open (then round again). Mostly a new look outside. */
export interface CityDef {
  id: 'telaviv' | 'jerusalem' | 'haifa' | 'eilat';
  /** Ground around the building: two checker tones and a speck. */
  ground: [string, string, string];
  /** Sidewalk tiles: two tones and the joint lines. */
  sidewalk: [string, string, string];
  /** Tree sprites for the map's two tree variants. */
  trees: [TreeKind, TreeKind];
}

export type TreeKind = 'palm' | 'round' | 'olive' | 'cypress';
export const TREE_KINDS: readonly TreeKind[] = ['palm', 'round', 'olive', 'cypress'];

export const CITIES: readonly CityDef[] = [
  { id: 'telaviv', ground: ['#3E9150', '#43994F', '#2F7A3E'], sidewalk: ['#D8D2CA', '#CBC4BB', '#B2AAA0'], trees: ['palm', 'round'] },
  // Jerusalem stone: pale limestone pavers, olive trees and cypresses.
  { id: 'jerusalem', ground: ['#C9B48A', '#D2BE94', '#A8946C'], sidewalk: ['#E6D8B8', '#DCCDAA', '#B8A47E'], trees: ['olive', 'cypress'] },
  // Haifa: the green slopes of the Carmel.
  { id: 'haifa', ground: ['#2F7D46', '#35864B', '#24663A'], sidewalk: ['#C9D2D8', '#BCC6CE', '#9AA6B0'], trees: ['cypress', 'round'] },
  // Eilat: sand and palms.
  { id: 'eilat', ground: ['#E8CF94', '#EDD59C', '#CDB277'], sidewalk: ['#F2E6CC', '#EADCBE', '#C9B48E'], trees: ['palm', 'palm'] },
];

export const cityOf = (city: number): CityDef => CITIES[((city % CITIES.length) + CITIES.length) % CITIES.length]!;
