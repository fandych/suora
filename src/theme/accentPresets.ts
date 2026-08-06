export type AccentColorId =
  | 'default'
  | 'strong-blue'
  | 'tango-pink'
  | 'dark-tangerine'
  | 'lemon-curry'
  | 'persian-green'
  | 'turquoise'
  | 'skyline-blue'
  | 'oceanic-teal'
  | 'rose-taupe'

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
  'strong-blue': {
    accent: '#0024d3',
    hover: '#2346df',
    glow: 'rgba(0,36,211,0.22)',
    soft: 'rgba(0,36,211,0.10)',
    secondary: '#6d85ff',
    rgb: '0,36,211',
    swatchFill: 'bg-[#0024d3]',
    swatchRing: 'ring-[#0024d3]/45',
  },
  'tango-pink': {
    accent: '#F06473',
    hover: '#f37f8b',
    glow: 'rgba(240,100,115,0.22)',
    soft: 'rgba(240,100,115,0.10)',
    secondary: '#f7b0b8',
    rgb: '240,100,115',
    swatchFill: 'bg-[#F06473]',
    swatchRing: 'ring-[#F06473]/45',
  },
  'dark-tangerine': {
    accent: '#f58c35',
    hover: '#f7a154',
    glow: 'rgba(245,140,53,0.22)',
    soft: 'rgba(245,140,53,0.10)',
    secondary: '#f9c089',
    rgb: '245,140,53',
    swatchFill: 'bg-[#f58c35]',
    swatchRing: 'ring-[#f58c35]/45',
  },
  'lemon-curry': {
    accent: '#F5D34C',
    hover: '#f7dc6d',
    glow: 'rgba(245,211,76,0.22)',
    soft: 'rgba(245,211,76,0.10)',
    secondary: '#fae9a3',
    rgb: '245,211,76',
    swatchFill: 'bg-[#F5D34C]',
    swatchRing: 'ring-[#F5D34C]/45',
  },
  'persian-green': {
    accent: '#00B48F',
    hover: '#1ac4a1',
    glow: 'rgba(0,180,143,0.22)',
    soft: 'rgba(0,180,143,0.10)',
    secondary: '#7adbc8',
    rgb: '0,180,143',
    swatchFill: 'bg-[#00B48F]',
    swatchRing: 'ring-[#00B48F]/45',
  },
  turquoise: {
    accent: '#00A8BF',
    hover: '#1db7cd',
    glow: 'rgba(0,168,191,0.22)',
    soft: 'rgba(0,168,191,0.10)',
    secondary: '#7ad7e3',
    rgb: '0,168,191',
    swatchFill: 'bg-[#00A8BF]',
    swatchRing: 'ring-[#00A8BF]/45',
  },
  'skyline-blue': {
    accent: '#00a9eb',
    hover: '#24b7ef',
    glow: 'rgba(0,169,235,0.22)',
    soft: 'rgba(0,169,235,0.10)',
    secondary: '#86d9f8',
    rgb: '0,169,235',
    swatchFill: 'bg-[#00a9eb]',
    swatchRing: 'ring-[#00a9eb]/45',
  },
  'oceanic-teal': {
    accent: '#008cb7',
    hover: '#1d9ec7',
    glow: 'rgba(0,140,183,0.22)',
    soft: 'rgba(0,140,183,0.10)',
    secondary: '#7bc5db',
    rgb: '0,140,183',
    swatchFill: 'bg-[#008cb7]',
    swatchRing: 'ring-[#008cb7]/45',
  },
  'rose-taupe': {
    accent: '#954f72',
    hover: '#ab6687',
    glow: 'rgba(149,79,114,0.22)',
    soft: 'rgba(149,79,114,0.10)',
    secondary: '#c796af',
    rgb: '149,79,114',
    swatchFill: 'bg-[#954f72]',
    swatchRing: 'ring-[#954f72]/45',
  },
}

export function isAccentPreset(value: string): value is Exclude<AccentColorId, 'default'> {
  return value in ACCENT_PRESETS
}