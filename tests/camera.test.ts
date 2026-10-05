import { describe, expect, it } from 'vitest';
import { CAMERA, clampCam, glide, minZoomFor, zoomAt, type Cam } from '../src/render/camera';
import { touchEnd, touchMove, touchStart, TOUCH, type Finger } from '../src/render/touches';

const WORLD = { minX: -1000, minY: -200, maxX: 1000, maxY: 900 };
const W = 844;
const H = 390;

const finger = (id: number, x: number, y: number): Finger => ({ id, x, y });

describe('camera', () => {
  it('keeps the map covering the screen', () => {
    const cam: Cam = { x: 99999, y: -99999, zoom: 1 };
    clampCam(cam, WORLD, W, H);
    // Left edge at most EDGE px inside the screen, bottom edge at least EDGE px past it.
    expect(cam.x + WORLD.minX * cam.zoom).toBeLessThanOrEqual(CAMERA.edge);
    expect(cam.y + WORLD.maxY * cam.zoom).toBeGreaterThanOrEqual(H - CAMERA.edge);
  });

  it('centers the map on an axis where it is smaller than the screen', () => {
    const cam: Cam = { x: 0, y: 0, zoom: 0.1 };
    clampCam(cam, WORLD, W, H);
    const left = cam.x + WORLD.minX * cam.zoom;
    const right = cam.x + WORLD.maxX * cam.zoom;
    expect(left + right).toBeCloseTo(W, 5);
  });

  it('zooms around the fingers: the point under them stays put', () => {
    const cam: Cam = { x: 400, y: 100, zoom: 1 };
    const px = 420;
    const py = 200;
    const worldX = (px - cam.x) / cam.zoom;
    const worldY = (py - cam.y) / cam.zoom;
    zoomAt(cam, 1.5, px, py, WORLD, W, H);
    expect(cam.zoom).toBeCloseTo(1.5, 5);
    expect(cam.x + worldX * cam.zoom).toBeCloseTo(px, 5);
    expect(cam.y + worldY * cam.zoom).toBeCloseTo(py, 5);
  });

  it('never zooms past the limits', () => {
    const cam: Cam = { x: 0, y: 0, zoom: 1 };
    zoomAt(cam, 100, 0, 0, WORLD, W, H);
    expect(cam.zoom).toBe(CAMERA.maxZoom);
    zoomAt(cam, 0.0001, 0, 0, WORLD, W, H);
    expect(cam.zoom).toBe(minZoomFor(WORLD, W, H));
  });

  it('a flick glides, slows down and stops', () => {
    const cam: Cam = { x: 0, y: 0, zoom: 1 };
    clampCam(cam, WORLD, W, H);
    const vel = { x: 300, y: 0 };
    const x0 = cam.x;
    let frames = 0;
    while (glide(cam, vel, 16, WORLD, W, H) && frames < 1000) frames++;
    expect(cam.x).toBeGreaterThan(x0);
    expect(frames).toBeGreaterThan(10);
    expect(frames).toBeLessThan(1000);
  });

  it('a glide stops at the map edge', () => {
    const cam: Cam = { x: 0, y: 0, zoom: 1 };
    const vel = { x: 1e6, y: 0 };
    glide(cam, vel, 16, WORLD, W, H);
    expect(vel.x).toBe(0);
  });
});

describe('touches', () => {
  it('a short still touch is a tap where the finger went down', () => {
    const tr = touchStart([finger(1, 100, 50)], 0);
    touchMove(tr, [finger(1, 103, 52)], 50);
    const { tap, fling } = touchEnd(tr, 120);
    expect(tap).toEqual({ x: 100, y: 50 });
    expect(fling).toBeNull();
  });

  it('a drag pans by the finger movement and is not a tap', () => {
    const tr = touchStart([finger(1, 100, 50)], 0);
    const d = touchMove(tr, [finger(1, 140, 30)], 16)!;
    expect(d.dx).toBe(40);
    expect(d.dy).toBe(-20);
    expect(d.scale).toBe(1);
    expect(touchEnd(tr, 400).tap).toBeNull();
  });

  it('a long press is not a tap', () => {
    const tr = touchStart([finger(1, 100, 50)], 0);
    expect(touchEnd(tr, TOUCH.tapMs + 1).tap).toBeNull();
  });

  it('two fingers spreading apart zoom in around their middle', () => {
    const tr = touchStart([finger(1, 100, 100)], 0);
    expect(touchMove(tr, [finger(1, 100, 100), finger(2, 200, 100)], 10)).toBeNull(); // re-anchor
    const d = touchMove(tr, [finger(1, 50, 100), finger(2, 250, 100)], 20)!;
    expect(d.scale).toBeCloseTo(2, 5);
    expect(d.cx).toBe(150);
    expect(d.dx).toBe(0);
    const end = touchEnd(tr, 30);
    expect(end.tap).toBeNull();
    expect(end.fling).toBeNull();
  });

  it('lifting one of two fingers does not jump the map', () => {
    const tr = touchStart([finger(1, 100, 100), finger(2, 300, 100)], 0);
    expect(touchMove(tr, [finger(2, 300, 100)], 10)).toBeNull();
    const d = touchMove(tr, [finger(2, 310, 100)], 20)!;
    expect(d.dx).toBe(10);
  });

  it('a quick release after a drag flicks the map in that direction', () => {
    const tr = touchStart([finger(1, 0, 0)], 0);
    for (let i = 1; i <= 10; i++) touchMove(tr, [finger(1, i * 20, 0)], i * 16);
    const { fling } = touchEnd(tr, 165);
    expect(fling).not.toBeNull();
    expect(fling!.x).toBeGreaterThan(800);
    expect(Math.abs(fling!.y)).toBeLessThan(1);
  });

  it('a drag that stopped before release does not flick', () => {
    const tr = touchStart([finger(1, 0, 0)], 0);
    touchMove(tr, [finger(1, 100, 0)], 16);
    expect(touchEnd(tr, 600).fling).toBeNull();
  });
});
