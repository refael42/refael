/** Modern light "glass" theme shared by every panel. */
export const C = {
  text: '#0f172a',
  textDim: '#64748b',
  textFaint: '#94a3b8',
  glass: 'rgba(255,255,255,0.88)',
  glassStrong: 'rgba(255,255,255,0.97)',
  glassEdge: 'rgba(255,255,255,0.95)',
  line: 'rgba(15,23,42,0.08)',
  chip: '#f1f5f9',
  track: '#e2e8f0',
  primary: '#6366f1',
  primarySoft: '#eef2ff',
  green: '#10b981',
  greenSoft: '#ecfdf5',
  amber: '#f59e0b',
  blue: '#3b82f6',
  red: '#ef4444',
  redSoft: '#fef2f2',
  gold: '#fbbf24',
  night: '#0b1022',
  // kept for older screens
  ink: '#0f172a',
  panel: '#ffffff',
  panelHi: '#f1f5f9',
  panelLine: '#e2e8f0',
  orange: '#f59e0b',
  sky: '#8fd0ff',
  grass: '#8fce78',
};

export const R = { s: 10, m: 16, l: 22, pill: 999 };

/** Soft elevation (boxShadow works on web, iOS and Android with the new architecture). */
export const SHADOW = { boxShadow: '0px 6px 20px rgba(15,23,42,0.16)' } as const;
export const SHADOW_SM = { boxShadow: '0px 3px 10px rgba(15,23,42,0.14)' } as const;
