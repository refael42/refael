import { Platform, type TextStyle } from 'react-native';

// UI colors match the scene art (same ink, same warm palette) so menus feel part of the world.
export const theme = {
  ink: '#4A2F27',
  cream: '#FFF4E3',
  paper: '#FFE9CC',
  tomato: '#E25545',
  mustard: '#F4C542',
  teal: '#2FA39A',
  wood: '#8E5A3C',
} as const;

/** The casino-resort look of the menus: deep plum panels with gold trim, like the walls. */
export const gold = '#E2B13C';
export const panel = { bg: 'rgba(42,21,48,0.96)', row: '#3A1D40' } as const;

/**
 * A hard drop shadow under text (game-title look). Web wants the one-string form and warns
 * about the separate props; phones only know the separate props.
 */
export function textShadow(color: string, dy: number, blur: number): TextStyle {
  return Platform.OS === 'web'
    ? ({ textShadow: `0px ${dy}px ${blur}px ${color}` } as TextStyle)
    : { textShadowColor: color, textShadowOffset: { width: 0, height: dy }, textShadowRadius: blur };
}
