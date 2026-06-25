export type AccentColorId =
  | 'default'
  | 'amber'
  | 'sapphire'
  | 'emerald'
  | 'amethyst'
  | 'coral'
  | 'rose'
  | 'jade'
  | 'crimson'
  | 'copper'
  | 'arctic'
  | 'slate'

export interface AccentPreset {
  accent: string
  hover: string
  glow: string
  soft: string
  secondary: string
  rgb: string
  swatchFill: string
  swatchRing: string
}

export const DEFAULT_ACCENT_COLOR: AccentColorId = 'default'

export const ACCENT_PRESETS: Record<Exclude<AccentColorId, 'default'>, AccentPreset> = {
  amber: {
    accent: '#C99A2E',
    hover: '#D7A93F',
    glow: 'rgba(201,154,46,0.22)',
    soft: 'rgba(201,154,46,0.10)',
    secondary: '#E2BC62',
    rgb: '201,154,46',
    swatchFill: 'bg-[#C99A2E]',
    swatchRing: 'ring-[#C99A2E]/45',
  },
  sapphire: {
    accent: '#215DFF',
    hover: '#4678FF',
    glow: 'rgba(33,93,255,0.22)',
    soft: 'rgba(33,93,255,0.10)',
    secondary: '#8EAEFF',
    rgb: '33,93,255',
    swatchFill: 'bg-[#215DFF]',
    swatchRing: 'ring-[#215DFF]/45',
  },
  emerald: {
    accent: '#158F74',
    hover: '#22A785',
    glow: 'rgba(21,143,116,0.20)',
    soft: 'rgba(21,143,116,0.10)',
    secondary: '#67C3A8',
    rgb: '21,143,116',
    swatchFill: 'bg-[#158F74]',
    swatchRing: 'ring-[#158F74]/45',
  },
  amethyst: {
    accent: '#8B5CF6',
    hover: '#A78BFA',
    glow: 'rgba(139,92,246,0.22)',
    soft: 'rgba(139,92,246,0.10)',
    secondary: '#C4B5FD',
    rgb: '139,92,246',
    swatchFill: 'bg-[#8B5CF6]',
    swatchRing: 'ring-[#8B5CF6]/45',
  },
  coral: {
    accent: '#E06848',
    hover: '#EB8163',
    glow: 'rgba(224,104,72,0.22)',
    soft: 'rgba(224,104,72,0.10)',
    secondary: '#F2A38F',
    rgb: '224,104,72',
    swatchFill: 'bg-[#E06848]',
    swatchRing: 'ring-[#E06848]/45',
  },
  rose: {
    accent: '#D44878',
    hover: '#E16692',
    glow: 'rgba(212,72,120,0.22)',
    soft: 'rgba(212,72,120,0.10)',
    secondary: '#EE9AB7',
    rgb: '212,72,120',
    swatchFill: 'bg-[#D44878]',
    swatchRing: 'ring-[#D44878]/45',
  },
  jade: {
    accent: '#1C9B8E',
    hover: '#2CB4A6',
    glow: 'rgba(28,155,142,0.22)',
    soft: 'rgba(28,155,142,0.10)',
    secondary: '#79D0C7',
    rgb: '28,155,142',
    swatchFill: 'bg-[#1C9B8E]',
    swatchRing: 'ring-[#1C9B8E]/45',
  },
  crimson: {
    accent: '#CC3340',
    hover: '#DA5360',
    glow: 'rgba(204,51,64,0.22)',
    soft: 'rgba(204,51,64,0.10)',
    secondary: '#F08D96',
    rgb: '204,51,64',
    swatchFill: 'bg-[#CC3340]',
    swatchRing: 'ring-[#CC3340]/45',
  },
  copper: {
    accent: '#C07840',
    hover: '#CE8D58',
    glow: 'rgba(192,120,64,0.22)',
    soft: 'rgba(192,120,64,0.10)',
    secondary: '#E0AF86',
    rgb: '192,120,64',
    swatchFill: 'bg-[#C07840]',
    swatchRing: 'ring-[#C07840]/45',
  },
  arctic: {
    accent: '#4AA8D0',
    hover: '#68B9DB',
    glow: 'rgba(74,168,208,0.22)',
    soft: 'rgba(74,168,208,0.10)',
    secondary: '#9FD3E7',
    rgb: '74,168,208',
    swatchFill: 'bg-[#4AA8D0]',
    swatchRing: 'ring-[#4AA8D0]/45',
  },
  slate: {
    accent: '#6B7B99',
    hover: '#8393B0',
    glow: 'rgba(107,123,153,0.20)',
    soft: 'rgba(107,123,153,0.10)',
    secondary: '#B1BDD1',
    rgb: '107,123,153',
    swatchFill: 'bg-[#6B7B99]',
    swatchRing: 'ring-[#6B7B99]/45',
  },
}

export function isAccentPreset(value: string): value is Exclude<AccentColorId, 'default'> {
  return value in ACCENT_PRESETS
}