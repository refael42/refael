import { ClipOp, type SkCanvas, type SkPath } from '@shopify/react-native-skia';
import { sprite } from '../sprite';
import { contactShadow, dot, fill, INK, ink, line, path, stroke, type Pt } from './kit';

// Character space: origin between the feet, y grows downward (so the head is at negative y).
// Tintable parts are drawn in white/grey and colored at draw time (skin, hair, shirt, pants).

const W = '#FFFFFF';
const HX = 0.6; // head center x (slightly right = 3/4 turn)
const HY = -32;
const FX = HX + 1.8; // face center
const FY = HY + 1.5;
const EYE = '#33221C';
const BLUSH = '#FF8C8C';

const headShape = () =>
  path.smooth([
    [HX, HY - 10.6],
    [HX + 9.8, HY - 7.4],
    [HX + 11.6, HY + 0.5],
    [HX + 9.3, HY + 7.6],
    [HX + 1, HY + 10.6],
    [HX - 8.4, HY + 7.6],
    [HX - 11.4, HY + 0.5],
    [HX - 9.8, HY - 7.4],
  ]);

const BODY_PTS: Pt[] = [
  [-7.6, -23],
  [0.6, -23.6],
  [8.6, -23],
  [10.4, -15.5],
  [10.6, -8.6],
  [6.5, -6.2],
  [0.5, -5.8],
  [-5.6, -6.2],
  [-9.6, -8.6],
  [-9.6, -15.5],
];
const bodyShape = () => path.smooth(BODY_PTS);

/** Union of circles: fluffy shapes (curls, chef hat, foliage) with a single clean outline. */
export function bumps(circles: readonly (readonly [number, number, number])[]): SkPath {
  let out = path.circle(circles[0]![0], circles[0]![1], circles[0]![2]);
  for (let i = 1; i < circles.length; i++) {
    const [x, y, r] = circles[i]!;
    out = path.union(out, path.circle(x, y, r));
  }
  return out;
}

function clipped(c: SkCanvas, clip: SkPath, draw: () => void) {
  c.save();
  c.clipPath(clip, ClipOp.Intersect, true);
  draw();
  c.restore();
}

// ---------- base body parts (tinted) ----------

const shadow = sprite([-14, -6, 14, 6], (c) => contactShadow(c, 0, 0, 10.5, 3.6, 0.24));

const head = sprite([-13, -45, 14, -19], (c) => {
  ink(c, path.oval(HX - 11.1, HY + 1.6, 2.4, 3), W); // ear (visible on the far side in 3/4 view)
  ink(c, headShape(), W, { depth: 2.2 });
});

const headBack = sprite([-13, -45, 14, -19], (c) => {
  ink(c, path.oval(HX - 11.3, HY + 1.6, 2.4, 3), W);
  ink(c, path.oval(HX + 11.6, HY + 1.6, 2.4, 3), W);
  ink(c, headShape(), W, { depth: 2.2 });
});

const body = sprite([-12, -26, 13, -4], (c) => ink(c, bodyShape(), W, { depth: 2.4 }));

const bodyHoodie = sprite([-13, -27, 14, -4], (c) => {
  ink(c, bodyShape(), W, { depth: 2.4 });
  // Kangaroo pocket and the hood rolled around the neck.
  line(c, [[-5.6, -8], [-4.4, -13.4], [5.6, -13.4], [6.8, -8]], '#C9BFB8', 1.1);
  ink(c, path.oval(HX, -23, 9.6, 3.4), W, { depth: 1.2 });
});

const bodyHoodieBack = sprite([-13, -30, 14, -4], (c) => {
  ink(c, bodyShape(), W, { depth: 2.4 });
  ink(c, path.smooth([[-7.6, -24], [0.6, -26.5], [8.8, -24], [7.4, -16.5], [0.6, -14.6], [-6.2, -16.5]]), W, { depth: 1.6 });
});

/** Sleeve: anchored at the shoulder, hangs down; rotated for arm swings. */
const arm = sprite([-4, -4, 4, 11], (c) => ink(c, path.rrect(-2.7, -2.4, 5.4, 11, 2.7), W, { depth: 1.2 }));
const hand = sprite([-4, -4, 4, 4], (c) => ink(c, path.circle(0, 0, 2.45), W, { depth: 0.9 }));
/** Leg: anchored at the hip. */
const leg = sprite([-4, -2.5, 4, 8], (c) => ink(c, path.rrect(-2.6, -1.2, 5.2, 7.6, 2.4), W, { depth: 1 }));
const shoe = sprite([-5, -6, 5.5, 1.5], (c) =>
  ink(c, path.smooth([[-3.2, -0.3], [-3.4, -2.6], [-1.2, -3.9], [1.8, -3.7], [3.7, -2], [3.4, -0.2]]), '#5A3B30', { depth: 0.9 }),
);

// ---------- faces (untinted, drawn over the head) ----------

function eyes(c: SkCanvas, scale = 1) {
  for (const ex of [FX - 3.6, FX + 3.6]) {
    c.drawOval(
      { x: ex - 1.35 * scale, y: FY - 1 - 1.8 * scale, width: 2.7 * scale, height: 3.6 * scale },
      fill(EYE),
    );
    dot(c, ex + 0.45, FY - 1.8, 0.55, W);
  }
}
function blush(c: SkCanvas, alpha = 0.45) {
  c.drawOval({ x: FX - 8.2, y: FY + 1.3, width: 4, height: 2.3 }, fill(BLUSH, alpha));
  c.drawOval({ x: FX + 4.2, y: FY + 1.3, width: 4, height: 2.3 }, fill(BLUSH, alpha));
}
function closedEyes(c: SkCanvas, happy: boolean) {
  for (const ex of [FX - 3.6, FX + 3.6]) {
    const dy = happy ? -0.9 : 0.9;
    line(c, [[ex - 1.6, FY - 1], [ex, FY - 1 + dy], [ex + 1.6, FY - 1]], EYE, 1.05, true);
  }
}
const FACE_BOUNDS = [-10, -40, 13, -24] as const;

const faceHappy = sprite(FACE_BOUNDS, (c) => {
  eyes(c);
  blush(c);
  line(c, [[FX - 1.7, FY + 2.6], [FX, FY + 3.9], [FX + 1.7, FY + 2.6]], EYE, 1.05, true);
});
const faceNeutral = sprite(FACE_BOUNDS, (c) => {
  eyes(c);
  blush(c, 0.25);
  line(c, [[FX - 1.4, FY + 3.1], [FX + 1.4, FY + 3.1]], EYE, 1.05);
});
const faceAngry = sprite(FACE_BOUNDS, (c) => {
  eyes(c, 0.85);
  c.drawOval({ x: FX - 8.2, y: FY + 1.3, width: 4, height: 2.3 }, fill('#FF5A4A', 0.5));
  c.drawOval({ x: FX + 4.2, y: FY + 1.3, width: 4, height: 2.3 }, fill('#FF5A4A', 0.5));
  line(c, [[FX - 5.4, FY - 5.2], [FX - 2, FY - 3.8]], EYE, 1.2);
  line(c, [[FX + 5.4, FY - 5.2], [FX + 2, FY - 3.8]], EYE, 1.2);
  line(c, [[FX - 1.8, FY + 3.9], [FX, FY + 2.7], [FX + 1.8, FY + 3.9]], EYE, 1.05, true);
});
const faceSleepy = sprite(FACE_BOUNDS, (c) => {
  closedEyes(c, false);
  blush(c, 0.3);
  c.drawCircle(FX + 0.4, FY + 3.2, 0.9, stroke(EYE, 0.9));
});
const faceEating = sprite(FACE_BOUNDS, (c) => {
  closedEyes(c, true);
  blush(c, 0.55);
  ink(c, path.oval(FX, FY + 3.2, 1.6, 1.3), '#B5413A', { line: 0.8, shade: false, light: false });
});
const faceBlink = sprite(FACE_BOUNDS, (c) => {
  for (const ex of [FX - 3.6, FX + 3.6]) line(c, [[ex - 1.5, FY - 1], [ex + 1.5, FY - 1]], EYE, 1.05);
  blush(c);
  line(c, [[FX - 1.7, FY + 2.6], [FX, FY + 3.9], [FX + 1.7, FY + 2.6]], EYE, 1.05, true);
});
const faceChew = sprite(FACE_BOUNDS, (c) => {
  closedEyes(c, true);
  blush(c, 0.55);
  line(c, [[FX - 1.5, FY + 2.8], [FX, FY + 3.6], [FX + 1.5, FY + 2.8]], EYE, 1.05, true);
});

// ---------- hair (tinted). front = over the head, behind = before the head, back = rear view ----------

const HAIR_BOUNDS = [-19, -54, 19, -15] as const;

const shortFront = () =>
  path.smooth([
    [-11.5, -31.5], [-11.4, -38.2], [-6, -43.4], [1.2, -44.8], [8.4, -43], [12.8, -37.6], [13.1, -31.4],
    [11.3, -33], [10, -36.4], [5.6, -37.4], [1.8, -36], [-2.4, -37.4], [-6.4, -36], [-9.4, -35.4],
  ]);
const shortBack = () =>
  path.smooth([
    [-11.9, -31], [-11.2, -39], [-5, -43.9], [2, -44.9], [8.8, -43], [12.9, -38], [13.2, -31], [11.7, -25.6],
    [6, -23.6], [0.6, -24.3], [-5, -23.6], [-10.7, -25.6],
  ]);
const spikyTop: Pt[] = [
  [-11.4, -31], [-12.6, -38.5], [-11.6, -45], [-7.6, -43], [-4.6, -49.8], [-1.4, -44.4], [2.6, -50.6],
  [5, -44.6], [9.4, -48.6], [10.2, -43], [14.8, -43.8], [13, -37.6], [13.2, -31],
];

const hairShortF = sprite(HAIR_BOUNDS, (c) => ink(c, shortFront(), W, { depth: 1.6 }));
const hairShortB = sprite(HAIR_BOUNDS, (c) => ink(c, shortBack(), W, { depth: 1.6 }));

const hairBobBehind = sprite(HAIR_BOUNDS, (c) =>
  ink(c, path.smooth([[-13.8, -23.4], [-14.6, -33], [-11, -41.5], [HX, -45.6], [12.4, -41.5], [15.8, -33], [15, -23.4], [8, -21.6], [-7, -21.6]]), W, { depth: 1.4 }),
);
const hairBobF = sprite(HAIR_BOUNDS, (c) =>
  ink(c, path.smooth([[-12.6, -29.5], [-12, -38], [-6, -43.9], [1, -45.3], [8.6, -43.5], [13.5, -38], [14, -29.5], [12, -34.6], [9, -35.5], [HX, -35.8], [-7.8, -35.5], [-10.8, -34.2]]), W, { depth: 1.6 }),
);
const hairBobB = sprite(HAIR_BOUNDS, (c) =>
  ink(c, path.smooth([[-13.9, -23.4], [-14.4, -34], [-10.6, -42], [HX, -45.9], [12, -42], [15.6, -34], [15.2, -23.4], [8, -21.4], [HX, -22.4], [-7, -21.4]]), W, { depth: 1.6 }),
);

const ponytail = () =>
  path.smooth([[-8, -40.4], [-13.2, -39.2], [-17, -33], [-17.2, -25.6], [-14.6, -21.8], [-12.6, -27], [-11.4, -33.4]]);
const hairPonytailBehind = sprite(HAIR_BOUNDS, (c) => {
  ink(c, ponytail(), W, { depth: 1.4 });
  ink(c, path.oval(-9.8, -38.6, 1.8, 1.4), '#E25545', { line: 0.9, light: false });
});
const hairPonytailB = sprite(HAIR_BOUNDS, (c) => {
  ink(c, shortBack(), W, { depth: 1.6 });
  ink(c, path.smooth([[-3, -34], [4.2, -34], [5, -26.6], [3, -19], [HX, -16.8], [-1.8, -19], [-3.6, -26.6]]), W, { depth: 1.2 });
  ink(c, path.oval(HX, -33.4, 2.6, 1.5), '#E25545', { line: 0.9, light: false });
});

const curlCap: (readonly [number, number, number])[] = [
  [-9.4, -36.4, 4.3], [-5.4, -40.8, 4.9], [HX, -42.6, 5.3], [6.6, -41.2, 4.9], [11.2, -37, 4.3], [HX, -38.5, 6],
];
const hairCurlyBehind = sprite(HAIR_BOUNDS, (c) =>
  ink(c, bumps([[-13.4, -28.6, 4.4], [-13, -35.8, 5], [-9, -42, 5.4], [HX, -45, 6.2], [10, -42, 5.4], [14.2, -35.8, 5], [14.6, -28.6, 4.4]]), W, { depth: 1.4 }),
);
const hairCurlyF = sprite(HAIR_BOUNDS, (c) => ink(c, bumps(curlCap), W, { depth: 1.6 }));
const hairCurlyB = sprite(HAIR_BOUNDS, (c) =>
  ink(c, bumps([...curlCap, [-12.4, -30, 4.6], [13.6, -30, 4.6], [-8, -26.4, 4.6], [HX, -25.4, 5], [9.2, -26.4, 4.6], [HX, -33, 8]]), W, { depth: 1.6 }),
);

const hairSpikyF = sprite(HAIR_BOUNDS, (c) =>
  ink(c, path.smooth([...spikyTop, [11.4, -33.6], [8, -36.6], [3, -37.2], [-2, -36.2], [-6.6, -37], [-9.8, -35.2]], true, 0.6), W, { depth: 1.6 }),
);
const hairSpikyB = sprite(HAIR_BOUNDS, (c) =>
  ink(c, path.smooth([...spikyTop, [12, -25.6], [6, -23.6], [0.6, -24.3], [-5, -23.6], [-10.7, -25.6]], true, 0.6), W, { depth: 1.6 }),
);

const hairBunBehind = sprite(HAIR_BOUNDS, (c) => ink(c, path.circle(HX + 1, -46.2, 5.2), W, { depth: 1.2 }));
const hairBunB = sprite(HAIR_BOUNDS, (c) => {
  ink(c, shortBack(), W, { depth: 1.6 });
  ink(c, path.circle(HX, -43.4, 5.2), W, { depth: 1.2 });
});

// ---------- hats (fixed colors) ----------

const HAT_BOUNDS = [-21, -60, 22, -28] as const;

const hatToque = sprite(HAT_BOUNDS, (c) => {
  const puff = path.union(bumps([[-6.2, -47.6, 5.8], [HX, -50.6, 6.8], [7.6, -47.8, 5.8]]), path.rrect(-9.6, -48, 20.4, 8, 3));
  ink(c, puff, W, { shade: '#E4DCD7', depth: 2.2 });
  ink(c, path.rrect(-10.4, -42.6, 22, 6.2, 2.4), W, { shade: '#E4DCD7' });
  for (const x of [-5, 0.6, 6.2]) line(c, [[x, -41.4], [x, -37.6]], '#D9CFC9', 0.9);
});
const capDome = () =>
  path.smooth([[-11.8, -34.6], [-11, -40.4], [-5, -44.8], [HX + 1, -45.6], [8.6, -43.8], [12.8, -38.8], [13, -34.4], [HX, -35.6]]);
const hatCap = sprite(HAT_BOUNDS, (c) => {
  ink(c, capDome(), '#E25545', { depth: 1.8 });
  line(c, [[HX + 1, -45], [HX + 0.4, -35.8]], '#B8392C', 0.9);
  ink(c, path.smooth([[1.2, -35.8], [8, -37.4], [16.6, -36], [17.4, -33.2], [9, -32.6], [2.4, -33.6]]), '#C23F31', { depth: 1 });
  dot(c, HX + 1, -45.4, 1.1, '#B8392C');
});
const hatCapBack = sprite(HAT_BOUNDS, (c) => {
  ink(c, capDome(), '#E25545', { depth: 1.8 });
  ink(c, path.rrect(-2.6, -37.4, 6.4, 3, 1.4), '#C23F31', { light: false });
});
const hatSun = sprite(HAT_BOUNDS, (c) => {
  ink(c, path.oval(HX, -39.4, 19.4, 5.6), '#F3D18B', { shade: '#D9AE63', depth: 2 });
  ink(c, path.smooth([[-8.6, -40.6], [-7.6, -46.4], [HX, -49.4], [9, -46.4], [10, -40.6], [HX, -39]]), '#F3D18B', { shade: '#D9AE63', depth: 1.8 });
  ink(c, path.smooth([[-8.8, -41.8], [HX, -40.4], [10.2, -41.8], [10, -40], [HX, -38.6], [-8.6, -40]]), '#E25545', { line: 0.9, light: false });
  for (const x of [-14, -7, 7, 14]) line(c, [[x * 0.7 + HX, -37.6], [x + HX, -35.8]], '#D2A55B', 0.7);
});
const hatBeanie = sprite(HAT_BOUNDS, (c) => {
  ink(c, path.circle(HX, -46.8, 3.4), '#FFF3D6', { shade: '#EAD8B4' });
  ink(c, path.smooth([[-11, -37], [-10, -42.4], [-4.6, -46], [HX, -46.8], [6, -46], [11.4, -42.4], [12.4, -37]]), '#F2B63D', { depth: 1.8 });
  ink(c, path.rrect(-11.8, -39.4, 24.8, 5.6, 2.6), '#DE9A2A', { depth: 1 });
  for (let x = -9; x <= 11; x += 3.2) line(c, [[x, -38.6], [x, -34.8]], '#C4841F', 0.7);
});
const hatBandana = sprite(HAT_BOUNDS, (c) => {
  const cloth = path.smooth([[-12, -33.6], [-11.6, -40], [-5.6, -44.6], [HX + 1, -45.4], [8.4, -43.6], [13, -38.6], [13.2, -33.4], [HX, -35.4]]);
  ink(c, path.smooth([[-11, -35], [-16.6, -33.4], [-17.4, -29.6], [-13.4, -31.6]]), '#2FA39A', { line: 1.2 });
  ink(c, path.smooth([[-11.4, -34], [-15, -29], [-13.8, -26.4], [-11.2, -30.4]]), '#2A9187', { line: 1.2, light: false });
  ink(c, cloth, '#2FA39A', { depth: 1.8 });
  clipped(c, cloth, () => {
    for (const [x, y] of [[-6, -40], [0, -42.6], [6, -41], [10, -37.6], [-9, -36.4], [-2, -37.6], [4, -37]] as const) {
      dot(c, x, y, 1, '#E9FBF7');
    }
  });
});

// ---------- outfit details (untinted overlays on top of the tinted body) ----------

const OVER_BOUNDS = [-13, -27, 14, -3] as const;

const tee = sprite(OVER_BOUNDS, (c) => {
  const star = path.poly(
    Array.from({ length: 10 }, (_, i) => {
      const r = i % 2 === 0 ? 2.6 : 1.1;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      return [3.6 + Math.cos(a) * r, -14.2 + Math.sin(a) * r] as Pt;
    }),
  );
  c.drawPath(star, fill('#FFF7E0', 0.92));
});
const suit = sprite(OVER_BOUNDS, (c) => {
  ink(c, path.poly([[-2.8, -23.4], [4, -23.4], [0.7, -14.6]]), W, { line: 1, light: false });
  ink(c, path.poly([[0.7, -21.6], [2.1, -19.6], [1.5, -13.4], [0.7, -12.2], [-0.1, -13.4], [-0.7, -19.6]]), '#E25545', { line: 0.9, light: false });
  line(c, [[-3.6, -23], [0.2, -14.2]], '#1F2A42', 1);
  line(c, [[4.8, -23], [1.2, -14.2]], '#1F2A42', 1);
  dot(c, 1.4, -10.6, 0.8, '#1F2A42');
  dot(c, 1.4, -8.2, 0.8, '#1F2A42');
});
const hawaiianFlowers = (c: SkCanvas) =>
  clipped(c, bodyShape(), () => {
    const flower = (x: number, y: number, petal: string) => {
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5;
        dot(c, x + Math.cos(a) * 1.6, y + Math.sin(a) * 1.6, 1.25, petal);
      }
      dot(c, x, y, 0.9, '#F4B63A');
    };
    for (const [x, y, a] of [[-2.2, -19.4, 0.6], [6.4, -9.2, -0.4], [-6.8, -11.4, 1.1]] as const) {
      c.save();
      c.translate(x, y);
      c.rotate(a * 57.3, 0, 0);
      c.drawOval({ x: -1.4, y: -3.4, width: 2.8, height: 4.6 }, fill('#3E9C5A', 0.95));
      c.restore();
    }
    flower(-5.2, -17.4, '#FFFFFF');
    flower(5, -14, '#FFE9A8');
    flower(-1, -9.6, '#FFFFFF');
    flower(8, -20.4, '#FFFFFF');
  });
const hawaiian = sprite(OVER_BOUNDS, (c) => {
  hawaiianFlowers(c);
  ink(c, path.poly([[-3.4, -23.4], [0.6, -19.2], [-0.8, -23.4]]), '#FFF6E8', { line: 0.9, light: false, shade: false });
  ink(c, path.poly([[4.8, -23.4], [0.6, -19.2], [2, -23.4]]), '#FFF6E8', { line: 0.9, light: false, shade: false });
});
const hoodie = sprite(OVER_BOUNDS, (c) => {
  line(c, [[-1.4, -22], [-1.8, -16.6]], '#FFF7E8', 1);
  line(c, [[3, -22], [3.4, -16.6]], '#FFF7E8', 1);
  dot(c, -1.8, -16.4, 0.8, '#FFF7E8');
  dot(c, 3.4, -16.4, 0.8, '#FFF7E8');
});
const chef = sprite(OVER_BOUNDS, (c) => {
  line(c, [[-6.6, -22.2], [-1.6, -15.6], [2.6, -6.4]], '#D9CFC9', 1);
  for (const y of [-18.6, -14.4, -10.2]) {
    ink(c, path.circle(-2.6, y, 0.95), '#D6D9E0', { line: 0.7, light: false });
    ink(c, path.circle(4.2, y, 0.95), '#D6D9E0', { line: 0.7, light: false });
  }
  ink(c, path.smooth([[-4.6, -23.6], [HX, -22.4], [5.8, -23.6], [3.4, -19.4], [HX, -17.8], [-2.2, -19.4]]), '#E25545', { line: 1 });
});
const waiterVest = () => path.minus(bodyShape(), path.poly([[-2.6, -24.4], [3.8, -24.4], [0.6, -13.4]]));
const waiter = sprite(OVER_BOUNDS, (c) => {
  ink(c, waiterVest(), '#2E2A36', { depth: 1.8, light: '#5A5468' });
  ink(c, path.smooth([[-3.4, -23.6], [-2.6, -21], [HX, -22.2], [3.8, -21], [4.6, -23.6], [HX, -22.8]]), '#D8443A', { line: 0.9, light: false });
  dot(c, HX, -22.4, 0.9, '#B8392C');
  dot(c, 0.6, -10.8, 0.75, '#F2C14E');
  dot(c, 0.6, -8.2, 0.75, '#F2C14E');
});
const apron = () => path.smooth([[-7.4, -19.4], [8.6, -19.4], [8.8, -9], [7.4, -4.6], [0.6, -4], [-6.2, -4.6], [-7.6, -9]], true, 0.6);
const washer = sprite(OVER_BOUNDS, (c) => {
  line(c, [[-6.2, -19], [-3.6, -23.2]], '#2F6FA8', 1.3);
  line(c, [[7.4, -19], [4.8, -23.2]], '#2F6FA8', 1.3);
  ink(c, apron(), '#3F86C8', { depth: 1.8 });
  ink(c, path.rrect(-2.6, -13.2, 6.4, 4.2, 1.2), '#3577B3', { line: 0.9, light: false });
});

const suitBack = sprite(OVER_BOUNDS, (c) => line(c, [[0.6, -22.6], [0.6, -7]], '#1F2A42', 0.9));
const hawaiianBack = sprite(OVER_BOUNDS, hawaiianFlowers);
const waiterBack = sprite(OVER_BOUNDS, (c) => {
  ink(c, bodyShape(), '#2E2A36', { depth: 1.8, light: '#5A5468' });
  line(c, [[0.6, -22.4], [0.6, -7]], '#1C1922', 0.9);
});
const washerBack = sprite(OVER_BOUNDS, (c) => {
  line(c, [[-6, -22.8], [6.8, -10.6]], '#2F6FA8', 1.4);
  line(c, [[7.2, -22.8], [-5.6, -10.6]], '#2F6FA8', 1.4);
  ink(c, path.smooth([[-2.6, -11.6], [0.6, -10], [3.8, -11.6], [3.2, -8.4], [0.6, -9.4], [-2, -8.4]]), '#3F86C8', { line: 0.9, light: false });
});

// ---------- accessories ----------

const sunglasses = sprite(FACE_BOUNDS, (c) => {
  for (const ex of [FX - 3.7, FX + 3.7]) {
    ink(c, path.rrect(ex - 2.9, FY - 3.1, 5.8, 3.8, 1.5), '#2B2B38', { line: 0.9, light: false, shade: false });
    line(c, [[ex - 1.6, FY - 2.2], [ex - 0.2, FY - 2.6]], '#9EB6E0', 0.8);
  }
  line(c, [[FX - 0.8, FY - 2], [FX + 0.8, FY - 2]], INK, 0.9);
});
const glasses = sprite(FACE_BOUNDS, (c) => {
  for (const ex of [FX - 3.6, FX + 3.6]) {
    c.drawCircle(ex, FY - 1, 2.7, fill('#CFE8FF', 0.28));
    c.drawCircle(ex, FY - 1, 2.7, stroke(INK, 0.9));
  }
  line(c, [[FX - 0.9, FY - 1.4], [FX + 0.9, FY - 1.4]], INK, 0.9);
});
const camera = sprite(OVER_BOUNDS, (c) => {
  line(c, [[-5.6, -22.6], [-1.2, -14.6]], '#5A3B30', 0.9);
  line(c, [[7.2, -22.6], [5.4, -14.6]], '#5A3B30', 0.9);
  ink(c, path.rrect(-1.6, -16.2, 8.2, 5.2, 1.2), '#3C3F4A', { line: 1, light: '#6D7280' });
  ink(c, path.circle(2.5, -13.6, 1.9), '#7FA7D6', { line: 0.8, shade: '#5C86B8' });
  dot(c, 5, -15.4, 0.6, '#FFF3B0');
});
const PACK = '#F08A3C';
const backpackBehind = sprite([-14, -25, 15, -6], (c) => ink(c, path.rrect(-12.2, -22.4, 25.6, 14, 4.4), PACK, { depth: 1.6 }));
const backpackStraps = sprite(OVER_BOUNDS, (c) => {
  ink(c, path.rrect(-7.6, -23.4, 2.8, 12, 1.3), '#D46F25', { line: 0.9, light: false });
  ink(c, path.rrect(6.2, -23.4, 2.8, 12, 1.3), '#D46F25', { line: 0.9, light: false });
});
const backpackBack = sprite([-12, -26, 13, -5], (c) => {
  ink(c, path.rrect(-8.4, -23.2, 18, 15.4, 4.4), PACK, { depth: 2 });
  ink(c, path.rrect(-5.4, -15.8, 12, 6.6, 2.4), '#D46F25', { line: 1 });
  line(c, [[-4, -17.6], [6, -17.6]], '#A8551D', 0.8);
  c.drawPath(path.smooth([[-2.4, -23], [0.6, -25.8], [3.6, -23]], false), stroke(INK, 1.2));
});

// ---------- held items (anchored at the hand) ----------

const burger = (c: SkCanvas, x: number, y: number, s: number) => {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  ink(c, path.rrect(-4, -1.6, 8, 2.2, 1.1), '#E9A55B', { line: 0.8, light: false });
  ink(c, path.rrect(-4.4, -3.4, 8.8, 2, 1), '#7A4128', { line: 0.8, light: false });
  ink(c, path.poly([[-4.8, -3.6], [4.8, -3.6], [3.6, -2.4], [-3.6, -2.4]]), '#F4C542', { line: 0.6, light: false, shade: false });
  ink(c, path.smooth([[-4.4, -3.8], [-3.4, -6.8], [0, -7.8], [3.4, -6.8], [4.4, -3.8]]), '#F0B46A', { line: 0.8, light: '#FFE0A6' });
  for (const [sx, sy] of [[-1.6, -5.8], [1, -6.6], [2.4, -5.2]] as const) dot(c, sx, sy, 0.38, '#FFF6DE');
  c.restore();
};
const tray = (c: SkCanvas, full: boolean) => {
  ink(c, path.oval(0, -2.4, 11.4, 4), '#D7DEE6', { depth: 1.2, shade: '#AEB8C4' });
  c.drawOval({ x: -9, y: -5.3, width: 18, height: 5.4 }, stroke('#EEF2F6', 0.8));
  if (!full) return;
  ink(c, path.oval(-2, -3.6, 6.2, 2.2), W, { line: 1, shade: '#E2E6EC' });
  c.drawOval({ x: -7.2, y: -5.6, width: 10.4, height: 3.9 }, stroke('#5B8EDB', 0.6));
  burger(c, -2, -3.4, 0.8);
  ink(c, path.rrect(4.4, -10.6, 4.2, 6.6, 1.2), '#D9F0FF', { line: 0.9, light: false, alpha: 0.95 });
  ink(c, path.rrect(4.9, -8.6, 3.2, 4.2, 0.8), '#8A3F2B', { line: 0, ink: false, light: false });
  line(c, [[7.6, -10.4], [9, -13.4]], '#E25545', 0.9);
};
const trayFull = sprite([-13, -16, 13, 3], (c) => tray(c, true));
const trayEmpty = sprite([-13, -8, 13, 3], (c) => tray(c, false));
const phone = sprite([-3, -5, 3, 4], (c) => {
  ink(c, path.rrect(-1.8, -3.6, 3.6, 6.2, 0.9), '#2E2A36', { line: 0.8, light: false });
  c.drawRect({ x: -1.1, y: -2.8, width: 2.2, height: 4.2 }, fill('#8FD3FF'));
});
const spatula = sprite([-3, -15, 6, 3], (c) => {
  line(c, [[0, 1], [1.6, -6]], '#8E5A3C', 1.6);
  ink(c, path.rrect(0.2, -13.6, 4.4, 6.4, 1), '#C9D1D9', { line: 0.9, shade: '#9AA5B1' });
});

export const characterSprites = {
  shadow, head, headBack, body, bodyHoodie, bodyHoodieBack, arm, hand, leg, shoe,
  faceHappy, faceNeutral, faceAngry, faceSleepy, faceEating, faceChew, faceBlink,
  hairShortF, hairShortB, hairBobBehind, hairBobF, hairBobB, hairPonytailBehind, hairPonytailB,
  hairCurlyBehind, hairCurlyF, hairCurlyB, hairSpikyF, hairSpikyB, hairBunBehind, hairBunB,
  hatToque, hatCap, hatCapBack, hatSun, hatBeanie, hatBandana,
  tee, suit, hawaiian, hoodie, chef, waiter, washer, suitBack, hawaiianBack, waiterBack, washerBack,
  sunglasses, glasses, camera, backpackBehind, backpackStraps, backpackBack,
  trayFull, trayEmpty, phone, spatula,
};

export { burger as drawBurger };
