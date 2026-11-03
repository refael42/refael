/** M0 art test screen: every sprite family animated, with camera and FPS. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import { useDir, useLang, useT } from '../i18n';
import { ICON_NAMES } from '../render/art/icons';
import { OUTFITS } from '../render/art/people';
import { CAR_VARIANTS } from '../render/art/vehicles';
import { makeCamera, useCameraResponder } from '../render/camera';
import { GroundPainter, recordPicture } from '../render/ground';
import { depthOf, isoX, isoY } from '../render/iso';
import { makeRenderRes, SnapWriter, type RenderRes } from '../render/scene';
import { SceneCanvas } from '../render/SceneCanvas';
import { DIRS, dirIndex, TREE_KINDS, type SpriteSet } from '../render/sprites';
import { overlayText } from '../render/text';
import { recordFrame, useFrameLoop } from '../render/useFrameLoop';
import { useSettings } from '../settings/store';
import { createGame, DT, stepGame } from '../sim';
import { FpsMeter } from './FpsMeter';
import { readDebugParams } from './game/debugParams';
import { Icon } from './Icon';
import { C, SHADOW_SM } from './theme';

function buildGround() {
  return recordPicture(-1200, -200, 2400, 1400, (c) => {
    const g = new GroundPainter(c);
    for (let x = -2; x < 18; x++) {
      for (let y = -2; y < 16; y++) {
        g.rect(x, y, x + 1, y + 1, '#8fce78');
      }
    }
    g.rect(3, 5, 14, 11, '#9aa4b1');
    g.rect(3.1, 5.1, 13.9, 10.9, '#a7b0bb');
    g.line(3.5, 8, 13.5, 8, '#fbbf24', 3);
    g.rect(0, 2.6, 7, 3.4, '#d6b07a');
  });
}

interface Props {
  sprites: SpriteSet;
  onBack?: () => void;
}

export function Gallery({ sprites, onBack }: Props) {
  const t = useT();
  const dir = useDir();
  const lang = useLang();
  const setLang = useSettings((s) => s.setLang);
  const showFps = useSettings((s) => s.showFps);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const snap = useSharedValue<Float32Array>(new Float32Array(0));
  const res = useSharedValue<RenderRes | null>(null);
  const cam = useMemo(() => {
    const dc = readDebugParams().cam;
    return dc ? makeCamera(isoX(dc[0], dc[1]), isoY(dc[0], dc[1]), dc[2]) : makeCamera(isoX(8, 7), isoY(8, 7), 1);
  }, []);
  const offset = useRef({ x: 0, y: 0 });
  const responder = useCameraResponder(cam, () => {}, offset);
  const writer = useMemo(() => new SnapWriter(), []);
  const sim = useMemo(() => createGame(42), []);
  const clock = useRef({ acc: 0, t: 0 });

  useEffect(() => {
    res.value = makeRenderRes(sprites.atlas.image, sprites.atlas.rects, buildGround());
  }, [sprites, res]);

  useFrameLoop((dtMs) => {
    if (size.w <= 0) return;
    const t0 = performance.now();
    const k = clock.current;
    k.acc += dtMs / 1000;
    k.t += dtMs / 1000;
    let steps = 0;
    while (k.acc >= DT && steps < 8) {
      stepGame(sim);
      k.acc -= DT;
      steps++;
    }
    const time = k.t;
    cam.viewW = size.w;
    cam.viewH = size.h;
    const w = writer;
    w.begin(cam.x, cam.y, cam.zoom);
    w.sky = 0x8fce78;

    // planes rotating in place
    const spots: [number, number][] = [
      [5, 7.2],
      [8.2, 6.2],
      [11.6, 7.4],
      [6.4, 9.9],
      [10.6, 10.2],
    ];
    sprites.combos.forEach(([, ac], i) => {
      const spot = spots[i % spots.length];
      const d = Math.floor(time * 2.5 + i * 3) % DIRS;
      const x = isoX(spot[0], spot[1]);
      const y = isoY(spot[0], spot[1]);
      w.shadow(sprites.planeShadow(ac, d), x + 3, y + 2, 1, 0.22);
      w.sprite(sprites.plane(i, d), x, y, 1, depthOf(spot[0], spot[1]));
    });

    // people walking around a circle
    const n = OUTFITS.length;
    for (let i = 0; i < n; i++) {
      const a = time * 0.35 + (i / n) * Math.PI * 2;
      const wx = 7.5 + Math.cos(a) * 2.3;
      const wy = 12.6 + Math.sin(a) * 1.2;
      const vx = -Math.sin(a) * 2.3;
      const vy = Math.cos(a) * 1.2;
      const svx = vx - vy;
      const svy = vx + vy;
      const frame = Math.floor(time * 7 + i) % 4;
      w.sprite(sprites.person(i, svy < 0, svx < 0, frame), isoX(wx, wy), isoY(wx, wy), 1, depthOf(wx, wy));
    }
    // idle people
    for (let i = 0; i < 4; i++) w.sprite(sprites.person(i, false, i % 2 === 1, 4), isoX(2.2 + i * 0.5, 4.2), isoY(2.2 + i * 0.5, 4.2), 1, depthOf(2.2 + i * 0.5, 4.2));

    // fuel truck on a loop
    const ta = time * 0.5;
    const tx = 12.4 + Math.cos(ta) * 1.6;
    const ty = 2.8 + Math.sin(ta) * 1.1;
    const heading = Math.atan2(Math.cos(ta) * 1.1, -Math.sin(ta) * 1.6);
    const td = dirIndex(heading);
    w.shadow(sprites.vehicleShadow(0, td), isoX(tx, ty) + 2, isoY(tx, ty) + 2, 1, 0.25);
    w.sprite(sprites.vehicle(0, td), isoX(tx, ty), isoY(tx, ty), 1, depthOf(tx, ty));

    // baggage train on a smaller loop, every car variant turning in place, the small props
    const ba = -time * 0.6 + 1.5;
    const bx0 = 12.4 + Math.cos(ba) * 0.9;
    const by0 = 2.8 + Math.sin(ba) * 0.6;
    const bd = dirIndex(Math.atan2(-Math.cos(ba) * 0.6, Math.sin(ba) * 0.9));
    w.shadow(sprites.vehicleShadow(1, bd), isoX(bx0, by0) + 2, isoY(bx0, by0) + 2, 1, 0.25);
    w.sprite(sprites.vehicle(1, bd), isoX(bx0, by0), isoY(bx0, by0), 1, depthOf(bx0, by0));
    CAR_VARIANTS.forEach((_, i) => {
      const cx = 1.2 + (i % 6) * 1.25;
      const cy = 17.4 + Math.floor(i / 6) * 1.2;
      const cd = Math.floor(time * 1.2 + i * 2) % DIRS;
      w.shadow(sprites.carShadow(i, cd), isoX(cx, cy) + 1.5, isoY(cx, cy) + 1.5, 1, 0.25);
      w.sprite(sprites.car(i, cd), isoX(cx, cy), isoY(cx, cy), 1, depthOf(cx, cy));
    });
    const props = [sprites.lamp, sprites.cone, sprites.taxiSign, sprites.parkSign, sprites.trolleys, sprites.planter(0)];
    props.forEach((p, i) => w.sprite(p, isoX(9.5 + i * 0.9, 17.2), isoY(9.5 + i * 0.9, 17.2), 1, depthOf(9.5 + i * 0.9, 17.2)));

    // static objects and trees
    w.sprite(sprites.hut, isoX(0.6, 0.4), isoY(0.6, 0.4), 1, depthOf(1.6, 1.1));
    w.sprite(sprites.pump, isoX(4.2, 0.6), isoY(4.2, 0.6), 1, depthOf(4.7, 1));
    w.sprite(sprites.windsock(Math.floor(time / 4) % 8, Math.floor(time * 3) % 2), isoX(15, 1.5), isoY(15, 1.5), 1, depthOf(15, 1.5));
    let ti = 0;
    for (let kk = 0; kk < TREE_KINDS.length; kk++) {
      for (let s = 0; s < 3; s++) {
        const x = -1 + ti * 0.95;
        const y = 15 - (ti % 2) * 0.8;
        w.sprite(sprites.tree(kk, s), isoX(x, y), isoY(x, y), 1, depthOf(x, y));
        ti++;
      }
    }
    w.sprite(sprites.rock, isoX(15, 9), isoY(15, 9), 1, depthOf(15, 9));

    // overlay: bubble with icon, spinning coin, number text, bars
    const bx = isoX(5, 7.2);
    const by = isoY(5, 7.2, 1.3);
    const pulse = 1 + Math.sin(time * 6) * 0.06;
    w.over(sprites.icon('actLand'), bx, by, 1.4 * pulse);
    w.over(sprites.coin(Math.floor(time * 12)), isoX(8.2, 6.2), isoY(8.2, 6.2, 1.2) - ((time * 30) % 30), 1);
    overlayText(w, sprites, '+1.2K', isoX(11.6, 7.4), isoY(11.6, 7.4, 2.4), 1, 0);
    w.bar(isoX(6.4, 9.9), isoY(6.4, 9.9, 1.2), 46, (time * 0.25) % 1, 0xff9f1c);
    w.bar(isoX(6.4, 9.9), isoY(6.4, 9.9, 1.2) + 9 / cam.zoom, 46, (time * 0.15) % 1, 0x3fcf6e);
    ICON_NAMES.forEach((name, i) => {
      w.over(sprites.icon(name), isoX(-2, 2) + i * 26, isoY(-2, 2) - 40, 0.75);
    });
    snap.value = w.finish();
    recordFrame(performance.now() - t0);
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height, x, y } = e.nativeEvent.layout;
    offset.current = { x, y };
    setSize({ w: Math.round(width), h: Math.round(height) });
  };

  return (
    <View style={styles.root}>
      <View style={styles.canvasWrap} onLayout={onLayout} {...responder.panHandlers}>
        {size.w > 0 ? <SceneCanvas snap={snap} res={res} width={size.w} height={size.h} /> : null}
      </View>
      <View style={[styles.header, { flexDirection: dir.row }]} pointerEvents="box-none">
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { textAlign: dir.textAlign, writingDirection: dir.writingDirection }]} numberOfLines={1}>
            {t('gallery.title')}
          </Text>
          <Text style={[styles.sub, { textAlign: dir.textAlign, writingDirection: dir.writingDirection }]} numberOfLines={2}>
            {t('gallery.subtitle', { n: sprites.atlas.count })} · {t('gallery.build', { ms: sprites.atlas.buildMs })}
          </Text>
        </View>
        <Pressable style={styles.btn} onPress={() => setLang(lang === 'he' ? 'en' : 'he')}>
          <Text style={styles.btnText}>{lang === 'he' ? t('lang.en') : t('lang.he')}</Text>
        </Pressable>
        {onBack ? (
          <Pressable style={styles.btn} onPress={onBack}>
            <Text style={styles.btnText} numberOfLines={1}>
              {t('gallery.back')}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={[styles.icons, { flexDirection: dir.row }]} pointerEvents="none">
        {ICON_NAMES.slice(0, 12).map((n) => (
          <Icon key={n} name={n} size={26} />
        ))}
      </View>
      {showFps || !onBack ? (
        <View style={styles.fps} pointerEvents="none">
          <FpsMeter />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#8fce78' },
  canvasWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  header: { position: 'absolute', top: 10, left: 10, right: 10, gap: 8, alignItems: 'center', backgroundColor: C.glass, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: C.glassEdge, ...SHADOW_SM },
  title: { color: C.text, fontSize: 18, fontWeight: '800' },
  sub: { color: C.textDim, fontSize: 12, marginTop: 2 },
  btn: { backgroundColor: C.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  icons: { position: 'absolute', bottom: 12, left: 10, right: 10, gap: 8, flexWrap: 'wrap', justifyContent: 'center', backgroundColor: C.glass, borderRadius: 20, padding: 10, ...SHADOW_SM },
  fps: { position: 'absolute', top: 96, left: 10 },
});
