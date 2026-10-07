import type { SkCanvas } from '@shopify/react-native-skia';
import { sprite, type SpriteDef } from '../sprite';
import { box, cylinder, floorShadow, onFaceX, onFaceY, rectIn, type BoxSpec, type Shades } from './iso3d';

// Low-poly blocky characters (big cube head, square eyes, chunky limbs), built from lit boxes.
// Each part is described once in the character's own frame (f = forward, r = right, z = up) and
// baked for two views: F = facing down-right (+x, face visible) and B = facing up-right (-y,
// back visible). The renderer mirrors these for the two left-facing directions.

export type View = 'F' | 'B';

interface LBox {
  f: number;
  r: number;
  z: number;
  lf: number;
  lr: number;
  h: number;
  color: string;
  shade?: Partial<Shades>;
}

/** Tintable parts are white with grey faces; the tint paint multiplies in the real color. */
const WHITE: Partial<Shades> = { top: '#FFFFFF', left: '#E6E3E0', right: '#BEB9B5' };
const W = '#FFFFFF';

function toWorld(v: View, b: LBox): BoxSpec {
  return v === 'F'
    ? { x: b.f, y: -b.r, w: b.lf, d: b.lr, z: b.z, h: b.h, color: b.color, shade: b.shade }
    : { x: -b.r, y: -b.f, w: b.lr, d: b.lf, z: b.z, h: b.h, color: b.color, shade: b.shade };
}

const lbox = (c: SkCanvas, v: View, b: LBox) => box(c, toWorld(v, b));

/** Draw on the part's front face (F view only); a runs viewer-left to right over `lr` tiles. */
function front(c: SkCanvas, v: View, b: LBox, draw: () => void) {
  if (v === 'F') onFaceX(c, b.f + b.lf / 2, -b.r + b.lr / 2, draw);
}

/** Draw on the part's back face (B view only). */
function back(c: SkCanvas, v: View, b: LBox, draw: () => void) {
  if (v === 'B') onFaceY(c, -b.f + b.lf / 2, -b.r - b.lr / 2, draw);
}

/** Draw on the visible side face (the character's left); a runs back to front over `lf`. */
function side(c: SkCanvas, v: View, b: LBox, draw: () => void) {
  if (v === 'F') onFaceY(c, -b.r + b.lr / 2, b.f - b.lf / 2, draw);
  else onFaceX(c, -b.r + b.lr / 2, -b.f + b.lf / 2, draw);
}

// ---------- body geometry (shared by every character) ----------

const LEG = { lf: 0.075, lr: 0.075, h: 10 };
const legAt = (r: number): LBox => ({ f: 0, r, z: 0, ...LEG, color: W, shade: WHITE });
const shoeAt = (r: number): LBox => ({ f: 0.014, r, z: 0, lf: 0.1, lr: 0.082, h: 3, color: '#3A2A26' });
export const TORSO: LBox = { f: 0, r: 0, z: 10, lf: 0.15, lr: 0.25, h: 14, color: W, shade: WHITE };
const ARM_R = 0.165;
const armAt = (r: number): LBox => ({ f: 0, r, z: 11.5, lf: 0.07, lr: 0.07, h: 12, color: W, shade: WHITE });
const handAt = (r: number): LBox => ({ f: 0, r, z: 8.5, lf: 0.072, lr: 0.072, h: 3, color: W, shade: WHITE });
const ARM_UP: LBox = { f: 0.06, r: -ARM_R, z: 19.5, lf: 0.14, lr: 0.07, h: 4, color: W, shade: WHITE };
const HAND_UP: LBox = { f: 0.15, r: -ARM_R, z: 19.5, lf: 0.05, lr: 0.075, h: 4.5, color: W, shade: WHITE };
export const HEAD: LBox = { f: 0, r: 0, z: 24, lf: 0.28, lr: 0.28, h: 17, color: W, shade: WHITE };

/** Every character part shares one generous box so parts line up by construction. */
const CB = [-17, -68, 17, 6] as const;

type PartDraw = (c: SkCanvas, v: View) => void;
/** Builds the F and B sprites of one part. */
function part(draw: PartDraw): { F: SpriteDef; B: SpriteDef } {
  return { F: sprite(CB, (c) => draw(c, 'F')), B: sprite(CB, (c) => draw(c, 'B')) };
}

// Near = the character's left side (r < 0); it is the camera side in both views.
const legNear = part((c, v) => lbox(c, v, legAt(-0.056)));
const legFar = part((c, v) => lbox(c, v, legAt(0.056)));
const shoeNear = part((c, v) => lbox(c, v, shoeAt(-0.056)));
const shoeFar = part((c, v) => lbox(c, v, shoeAt(0.056)));
const torso = part((c, v) => lbox(c, v, TORSO));
const armNear = part((c, v) => lbox(c, v, armAt(-ARM_R)));
const armFar = part((c, v) => lbox(c, v, armAt(ARM_R)));
const handNear = part((c, v) => lbox(c, v, handAt(-ARM_R)));
const handFar = part((c, v) => lbox(c, v, handAt(ARM_R)));
const armUp = part((c, v) => lbox(c, v, ARM_UP));
const handUp = part((c, v) => lbox(c, v, HAND_UP));
const head = part((c, v) => {
  lbox(c, v, HEAD);
  // Ear on the visible side.
  side(c, v, HEAD, () => rectIn(c, 0.09, 28.5, 0.05, 4.5, '#000000', 0.08));
});

// ---------- faces (untinted, on the head's front face) ----------

const EYE = '#1E1414';
const MOUTH = '#7A1E22';
const EYES = [0.055, 0.17] as const;
function eyes(c: SkCanvas, squint = 0) {
  for (const a of EYES) {
    rectIn(c, a, 31 + squint, 0.055, 5.5 - squint * 2, EYE);
    rectIn(c, a + 0.008, 34.8 - squint, 0.018, 1.3, W, 0.95);
  }
}
function blush(c: SkCanvas, alpha = 0.4) {
  rectIn(c, 0.02, 28.6, 0.045, 1.8, '#FF6B6B', alpha);
  rectIn(c, 0.215, 28.6, 0.045, 1.8, '#FF6B6B', alpha);
}
function closedEyes(c: SkCanvas, happy: boolean) {
  for (const a of EYES) {
    rectIn(c, a, 32.6, 0.055, 1.3, EYE);
    rectIn(c, a - 0.004, happy ? 31.6 : 33.6, 0.014, 1.3, EYE);
    rectIn(c, a + 0.045, happy ? 31.6 : 33.6, 0.014, 1.3, EYE);
  }
}
function bigSmile(c: SkCanvas) {
  rectIn(c, 0.09, 25.6, 0.1, 3.4, MOUTH);
  rectIn(c, 0.095, 27.9, 0.09, 1.1, W);
}
const face = (draw: (c: SkCanvas) => void) => sprite(CB, (c) => front(c, 'F', HEAD, () => draw(c)));
const faceHappy = face((c) => {
  eyes(c);
  blush(c);
  bigSmile(c);
});
const faceNeutral = face((c) => {
  eyes(c);
  rectIn(c, 0.105, 26.6, 0.07, 1.2, MOUTH);
});
const faceAngry = face((c) => {
  eyes(c, 0.5);
  blush(c, 0.55);
  rectIn(c, 0.045, 37, 0.07, 1.4, EYE);
  rectIn(c, 0.165, 37, 0.07, 1.4, EYE);
  rectIn(c, 0.1, 26, 0.08, 1.3, MOUTH);
  rectIn(c, 0.088, 25.1, 0.016, 1.3, MOUTH);
  rectIn(c, 0.176, 25.1, 0.016, 1.3, MOUTH);
});
const faceSleepy = face((c) => {
  closedEyes(c, false);
  rectIn(c, 0.125, 25.8, 0.035, 2.2, MOUTH);
});
const faceEating = face((c) => {
  closedEyes(c, true);
  blush(c, 0.55);
  rectIn(c, 0.11, 25, 0.06, 4, MOUTH);
});
const faceChew = face((c) => {
  closedEyes(c, true);
  blush(c, 0.55);
  rectIn(c, 0.11, 26.4, 0.06, 1.3, MOUTH);
});
const faceBlink = face((c) => {
  closedEyes(c, false);
  blush(c);
  bigSmile(c);
});

// ---------- hair (tinted) ----------

const capBox = (h = 5, z = 38): LBox => ({ f: -0.005, r: 0, z, lf: 0.302, lr: 0.302, h, color: W, shade: WHITE });
const backSlab = (z = 29, h = 10): LBox => ({ f: -0.065, r: 0, z, lf: 0.175, lr: 0.302, h, color: W, shade: WHITE });
const fringe: LBox = { f: 0.145, r: 0.025, z: 37, lf: 0.016, lr: 0.23, h: 2.5, color: W, shade: WHITE };

const hairShort = part((c, v) => {
  lbox(c, v, backSlab());
  lbox(c, v, capBox());
  lbox(c, v, fringe);
});
const hairBob = part((c, v) => {
  lbox(c, v, { f: -0.03, r: 0, z: 24.5, lf: 0.245, lr: 0.312, h: 16, color: W, shade: WHITE });
  lbox(c, v, capBox(5.5));
  lbox(c, v, { f: 0.146, r: 0, z: 35.5, lf: 0.018, lr: 0.3, h: 3.5, color: W, shade: WHITE });
});
const hairPonytail = part((c, v) => {
  lbox(c, v, { f: -0.18, r: 0, z: 26, lf: 0.065, lr: 0.065, h: 13, color: W, shade: WHITE });
  lbox(c, v, backSlab());
  lbox(c, v, capBox());
  lbox(c, v, fringe);
});
const hairCurly = part((c, v) => {
  lbox(c, v, backSlab(27, 12));
  for (const [f, r, h] of [[-0.09, -0.09, 7], [-0.09, 0.09, 6], [0.09, -0.09, 6], [0.09, 0.09, 7], [0, 0, 8], [-0.09, 0, 6.5], [0.09, 0, 6.5], [0, -0.09, 7], [0, 0.09, 6]] as const) {
    lbox(c, v, { f, r, z: 37, lf: 0.12, lr: 0.12, h, color: W, shade: WHITE });
  }
});
const hairSpiky = part((c, v) => {
  lbox(c, v, backSlab());
  lbox(c, v, capBox(3.5));
  for (const [f, r, h] of [[-0.08, -0.08, 9], [-0.08, 0.08, 7], [0.07, -0.07, 7], [0.07, 0.08, 8.5], [0, 0, 10.5]] as const) {
    lbox(c, v, { f, r, z: 40, lf: 0.08, lr: 0.08, h, color: W, shade: WHITE });
  }
});
const hairBun = part((c, v) => {
  lbox(c, v, backSlab());
  lbox(c, v, capBox());
  lbox(c, v, fringe);
  lbox(c, v, { f: -0.04, r: 0, z: 43, lf: 0.13, lr: 0.13, h: 6.5, color: W, shade: WHITE });
});

// ---------- hats (fixed colors) ----------

const hatToque = part((c, v) => {
  lbox(c, v, { f: 0, r: 0, z: 38, lf: 0.304, lr: 0.304, h: 5, color: '#F4F1EC' });
  lbox(c, v, { f: 0, r: 0, z: 43, lf: 0.35, lr: 0.35, h: 12, color: '#FFFFFF', shade: { left: '#ECE8E2', right: '#CFC8C0' } });
  lbox(c, v, { f: 0, r: 0, z: 55, lf: 0.27, lr: 0.27, h: 2.5, color: '#FFFFFF', shade: { left: '#ECE8E2', right: '#CFC8C0' } });
});
const hatCap = part((c, v) => {
  lbox(c, v, { f: 0.19, r: 0, z: 38, lf: 0.14, lr: 0.28, h: 1.6, color: '#C8342A' });
  lbox(c, v, { f: -0.005, r: 0, z: 38, lf: 0.304, lr: 0.304, h: 6, color: '#E5483B' });
  lbox(c, v, { f: 0, r: 0, z: 44, lf: 0.04, lr: 0.04, h: 1, color: '#C8342A' });
});
const hatSun = part((c, v) => {
  lbox(c, v, { f: 0, r: 0, z: 39, lf: 0.48, lr: 0.48, h: 1.6, color: '#F2CF83' });
  lbox(c, v, { f: 0, r: 0, z: 40.6, lf: 0.29, lr: 0.29, h: 7, color: '#F2CF83' });
  lbox(c, v, { f: 0, r: 0, z: 40.6, lf: 0.296, lr: 0.296, h: 2.2, color: '#E5483B' });
});
const hatBeanie = part((c, v) => {
  lbox(c, v, { f: 0, r: 0, z: 36.5, lf: 0.312, lr: 0.312, h: 8, color: '#F2B33A' });
  lbox(c, v, { f: 0, r: 0, z: 36, lf: 0.32, lr: 0.32, h: 3, color: '#D9952A' });
  lbox(c, v, { f: 0, r: 0, z: 44.5, lf: 0.08, lr: 0.08, h: 3.5, color: '#FFF1D2' });
});
const hatBandana = part((c, v) => {
  lbox(c, v, { f: -0.17, r: -0.08, z: 35, lf: 0.05, lr: 0.06, h: 4, color: '#24877F' });
  const band: LBox = { f: 0, r: 0, z: 35.5, lf: 0.308, lr: 0.308, h: 7, color: '#2FA39A' };
  lbox(c, v, band);
  const dots = () => {
    for (const [a, b] of [[0.05, 40], [0.14, 37.5], [0.23, 40.5]] as const) rectIn(c, a, b, 0.026, 1.3, '#E9FBF7');
  };
  front(c, v, band, dots);
  back(c, v, band, dots);
  side(c, v, band, dots);
});

// ---------- outfit details (untinted overlays on the tinted torso) ----------

const T = TORSO;
const overlay = (drawFront: ((c: SkCanvas) => void) | null, drawSide: ((c: SkCanvas) => void) | null, drawBack: ((c: SkCanvas) => void) | null) =>
  part((c, v) => {
    if (drawFront) front(c, v, T, () => drawFront(c));
    if (drawSide) side(c, v, T, () => drawSide(c));
    if (drawBack) back(c, v, T, () => drawBack(c));
  });

const tee = overlay((c) => rectIn(c, 0.13, 17.5, 0.05, 3, '#FFF6DE', 0.9), null, null);
const suit = overlay(
  (c) => {
    rectIn(c, 0.085, 19, 0.07, 5, '#FFFFFF');
    rectIn(c, 0.11, 15, 0.02, 7.5, '#D8342C');
    rectIn(c, 0.105, 21.5, 0.03, 1.6, '#B5281F');
    rectIn(c, 0.113, 12.2, 0.014, 1.3, '#1A2235');
  },
  null,
  null,
);
const flowers = (c: SkCanvas, span: number) => {
  for (const [a, b, col] of [[0.25, 20, '#FFFFFF'], [0.6, 14, '#FFE38A'], [0.15, 13, '#FF8FB1'], [0.75, 20.5, '#FFFFFF'], [0.45, 17, '#FF8FB1']] as const) {
    rectIn(c, a * span, b, span * 0.12, 2, col);
  }
};
const hawaiian = overlay(
  (c) => {
    flowers(c, 0.24);
    rectIn(c, 0.09, 21.5, 0.06, 2.5, '#FFF6E8');
  },
  (c) => flowers(c, 0.14),
  (c) => flowers(c, 0.24),
);
const hoodie = overlay(
  (c) => {
    rectIn(c, 0.05, 11.5, 0.14, 4.5, '#000000', 0.12);
    rectIn(c, 0.095, 18, 0.01, 4.5, '#FFF6E8');
    rectIn(c, 0.135, 18, 0.01, 4.5, '#FFF6E8');
  },
  null,
  null,
);
const hood = part((c, v) => lbox(c, v, { f: -0.06, r: 0, z: 22.5, lf: 0.1, lr: 0.22, h: 4, color: W, shade: WHITE }));
const chef = overlay(
  (c) => {
    for (const b of [19.5, 16, 12.5]) {
      rectIn(c, 0.075, b, 0.018, 1.4, '#9AA3AE');
      rectIn(c, 0.147, b, 0.018, 1.4, '#9AA3AE');
    }
    rectIn(c, 0.06, 21.6, 0.12, 2.4, '#E5483B');
  },
  null,
  null,
);
const VEST = '#2A2433';
const waiter = overlay(
  (c) => {
    rectIn(c, 0, 10, 0.09, 12, VEST);
    rectIn(c, 0.15, 10, 0.09, 12, VEST);
    rectIn(c, 0.09, 10, 0.06, 6, VEST);
    rectIn(c, 0.095, 22, 0.05, 1.8, '#D8342C');
    rectIn(c, 0.113, 13, 0.014, 1.2, '#F2C14E');
  },
  (c) => rectIn(c, 0, 10, 0.14, 12.5, VEST),
  (c) => rectIn(c, 0, 10, 0.24, 13, VEST),
);
const APRON = '#3F86C8';
const washer = overlay(
  (c) => {
    rectIn(c, 0.03, 8.5, 0.18, 11.5, APRON);
    rectIn(c, 0.04, 20, 0.02, 4, APRON);
    rectIn(c, 0.18, 20, 0.02, 4, APRON);
    rectIn(c, 0.09, 12, 0.06, 3, '#3577B3');
  },
  (c) => rectIn(c, 0.12, 8.5, 0.02, 11.5, APRON),
  (c) => {
    rectIn(c, 0.04, 12, 0.025, 12, APRON);
    rectIn(c, 0.175, 12, 0.025, 12, APRON);
    rectIn(c, 0.04, 12, 0.16, 2, APRON);
  },
);

// ---------- accessories ----------

const sunglasses = face((c) => {
  rectIn(c, 0.04, 31, 0.2, 5.4, '#16141C');
  rectIn(c, 0.06, 34.6, 0.05, 1, '#8FB6FF');
  rectIn(c, 0.175, 34.6, 0.05, 1, '#8FB6FF');
});
const glasses = face((c) => {
  for (const a of [0.045, 0.16]) {
    rectIn(c, a, 30.2, 0.075, 1, EYE);
    rectIn(c, a, 36.6, 0.075, 1, EYE);
    rectIn(c, a, 30.2, 0.012, 7.4, EYE);
    rectIn(c, a + 0.063, 30.2, 0.012, 7.4, EYE);
  }
});
const camera = overlay(
  (c) => {
    rectIn(c, 0.02, 21, 0.015, 3, '#3A2A26');
    rectIn(c, 0.205, 21, 0.015, 3, '#3A2A26');
    rectIn(c, 0.07, 15, 0.1, 5, '#2E3140');
    rectIn(c, 0.1, 15.8, 0.04, 3, '#7FA7D6');
    rectIn(c, 0.15, 19.2, 0.015, 0.9, '#FFF3B0');
  },
  null,
  null,
);
const backpack = part((c, v) => {
  const pack: LBox = { f: -0.115, r: 0, z: 12, lf: 0.09, lr: 0.2, h: 13, color: '#F08A3C' };
  lbox(c, v, pack);
  back(c, v, pack, () => rectIn(c, 0.04, 13.5, 0.12, 5, '#D46F25'));
});
const backpackStraps = overlay(
  (c) => {
    rectIn(c, 0.03, 13, 0.025, 11, '#D46F25');
    rectIn(c, 0.185, 13, 0.025, 11, '#D46F25');
  },
  null,
  null,
);

// ---------- held items (anchored at the hand, drawn in screen space) ----------

function miniBurger(c: SkCanvas, x: number, y: number, z: number) {
  box(c, { x, y, z, w: 0.1, d: 0.1, h: 1.6, color: '#E9A55B' });
  box(c, { x, y, z: z + 1.6, w: 0.105, d: 0.105, h: 1.4, color: '#6B3A22' });
  box(c, { x, y, z: z + 3, w: 0.11, d: 0.11, h: 0.6, color: '#7BC67E' });
  box(c, { x, y, z: z + 3.6, w: 0.1, d: 0.1, h: 2.2, color: '#F0B46A' });
}
const trayBase = (c: SkCanvas) => {
  cylinder(c, 0, 0, 0.15, 0, 1.5, '#AEB8C4', '#DCE3EA');
};
const trayFull = sprite([-14, -24, 14, 6], (c) => {
  trayBase(c);
  cylinder(c, -0.02, 0.02, 0.08, 1.5, 1, '#E2E6EC', '#FFFFFF');
  miniBurger(c, -0.02, 0.02, 2.5);
  cylinder(c, 0.07, -0.07, 0.03, 1.5, 7, '#C7E8FF', '#8A3F2B');
});
const trayEmpty = sprite([-14, -8, 14, 6], trayBase);
const trayDirty = sprite([-14, -16, 14, 6], (c) => {
  trayBase(c);
  for (let i = 0; i < 3; i++) cylinder(c, 0.01 * i, -0.01 * i, 0.08, 1.5 + i * 1.6, 1.1, '#CFC9BE', '#EDE7DC');
  box(c, { x: 0.04, y: 0.05, z: 6.4, w: 0.02, d: 0.06, h: 0.8, color: '#A35A2E' });
});
const phone = sprite([-6, -12, 6, 4], (c) => {
  box(c, { x: 0, y: 0, w: 0.03, d: 0.07, h: 9, color: '#2E2A36' });
  onFaceX(c, 0.015, 0.035, () => rectIn(c, 0.008, 1.2, 0.054, 6.6, '#8FD3FF'));
});
const spatula = sprite([-6, -26, 10, 4], (c) => {
  box(c, { x: 0.05, y: 0, z: 0, w: 0.04, d: 0.03, h: 12, color: '#8E5A3C' });
  box(c, { x: 0.05, y: 0, z: 12, w: 0.12, d: 0.03, h: 7, color: '#C9D1D9' });
});
const menu = sprite([-8, -12, 8, 4], (c) => {
  box(c, { x: 0, y: 0, w: 0.03, d: 0.14, h: 8, color: '#C8342A' });
  onFaceX(c, 0.015, 0.07, () => rectIn(c, 0.02, 2, 0.1, 1, '#F2C14E'));
});

/** The shift manager's clipboard: a wooden board, a sheet, a metal clip. */
const clipboard = sprite([-8, -14, 8, 4], (c) => {
  box(c, { x: 0, y: 0, w: 0.03, d: 0.13, h: 11, color: '#A8703E' });
  onFaceX(c, 0.015, 0.065, () => rectIn(c, 0.012, 1, 0.106, 8.4, '#FFFDF4'));
  onFaceX(c, 0.015, 0.065, () => rectIn(c, 0.03, 3, 0.07, 0.6, '#9AA3AD'));
  onFaceX(c, 0.015, 0.065, () => rectIn(c, 0.03, 5, 0.07, 0.6, '#9AA3AD'));
  box(c, { x: 0, y: 0, z: 9.6, w: 0.04, d: 0.06, h: 1.8, color: '#C9D1D9' });
});

/** The promoter's flyers: a little fan of bright sheets, the top one with the restaurant's burger. */
const flyers = sprite([-9, -16, 9, 4], (c) => {
  const sheets: [number, string][] = [[-0.035, '#47B2BE'], [0, '#F38DB3'], [0.035, '#FFFDF4']];
  sheets.forEach(([dy, color], i) => {
    box(c, { x: 0, y: dy, z: i * 0.6, w: 0.02, d: 0.11, h: 12, color });
  });
  onFaceX(c, 0.012, 0.09, () => rectIn(c, 0.015, 7, 0.08, 3.4, '#E5483B'));
  onFaceX(c, 0.012, 0.09, () => rectIn(c, 0.03, 4.4, 0.05, 1.6, '#F2C14E'));
  onFaceX(c, 0.012, 0.09, () => rectIn(c, 0.02, 2, 0.07, 0.8, '#454556'));
});

const charShadow = sprite([-16, -10, 16, 10], (c) => floorShadow(c, 0, 0, 0.2, 0.34));

export const characterSprites = {
  charShadow,
  legNearF: legNear.F, legNearB: legNear.B, legFarF: legFar.F, legFarB: legFar.B,
  shoeNearF: shoeNear.F, shoeNearB: shoeNear.B, shoeFarF: shoeFar.F, shoeFarB: shoeFar.B,
  torsoF: torso.F, torsoB: torso.B, hoodF: hood.F, hoodB: hood.B,
  armNearF: armNear.F, armNearB: armNear.B, armFarF: armFar.F, armFarB: armFar.B,
  handNearF: handNear.F, handNearB: handNear.B, handFarF: handFar.F, handFarB: handFar.B,
  armUpF: armUp.F, armUpB: armUp.B, handUpF: handUp.F, handUpB: handUp.B,
  headF: head.F, headB: head.B,
  faceHappy, faceNeutral, faceAngry, faceSleepy, faceEating, faceChew, faceBlink,
  hairShortF: hairShort.F, hairShortB: hairShort.B, hairBobF: hairBob.F, hairBobB: hairBob.B,
  hairPonytailF: hairPonytail.F, hairPonytailB: hairPonytail.B, hairCurlyF: hairCurly.F, hairCurlyB: hairCurly.B,
  hairSpikyF: hairSpiky.F, hairSpikyB: hairSpiky.B, hairBunF: hairBun.F, hairBunB: hairBun.B,
  hatToqueF: hatToque.F, hatToqueB: hatToque.B, hatCapF: hatCap.F, hatCapB: hatCap.B,
  hatSunF: hatSun.F, hatSunB: hatSun.B, hatBeanieF: hatBeanie.F, hatBeanieB: hatBeanie.B,
  hatBandanaF: hatBandana.F, hatBandanaB: hatBandana.B,
  teeF: tee.F, teeB: tee.B, suitF: suit.F, suitB: suit.B, hawaiianF: hawaiian.F, hawaiianB: hawaiian.B,
  hoodieF: hoodie.F, hoodieB: hoodie.B, chefF: chef.F, chefB: chef.B, waiterF: waiter.F, waiterB: waiter.B,
  washerF: washer.F, washerB: washer.B,
  sunglasses, glasses, cameraF: camera.F, cameraB: camera.B,
  backpackF: backpack.F, backpackB: backpack.B, backpackStrapsF: backpackStraps.F, backpackStrapsB: backpackStraps.B,
  trayFull, trayEmpty, trayDirty, phone, spatula, menu, clipboard, flyers,
};

