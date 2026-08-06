/**
 * Icon components for channels, agents, and skills.
 *
 * Supports two icon formats:
 *   1. Built-in preset icons: "agent-robot", "skill-git", "channel-slack"
 *   2. Iconify offline icons: "mdi:home", "lucide:settings", "ph:robot"
 *
 * Usage:
 *   <IconifyIcon name="agent-robot" size={24} />
 *   <IconifyIcon name="mdi:home" size={20} className="text-red-500" />
 *   <IconifyIcon name="channel-slack" />
 */
import { Icon as OfflineIcon } from '@iconify/react'
import { useState, useEffect } from 'react'
import { isCollectionLoaded, loadIconCollection } from '@/services/iconService'
import iconData from './icon-data.json'

// ─── Icon Data ─────────────────────────────────────────────────────

interface IconData {
  /** viewBox width */
  vw: number
  /** viewBox height */
  vh: number
  /** default fill color */
  color: string
  /** SVG inner body (paths, circles, etc.) */
  body: string
}

export const ICON_DATA = iconData as Record<string, IconData>

export type IconName = keyof typeof ICON_DATA

export type ChannelIconName = Extract<IconName, `channel-${string}`>
export type AgentIconName = Extract<IconName, `agent-${string}`>
export type SkillIconName = Extract<IconName, `skill-${string}`>

// ─── Helpers ───────────────────────────────────────────────────────

/** All available channel icon names */
export const CHANNEL_ICON_NAMES = Object.keys(ICON_DATA).filter((k) => k.startsWith('channel-')) as ChannelIconName[]

/** All available agent icon names */
export const AGENT_ICON_NAMES = Object.keys(ICON_DATA).filter((k) => k.startsWith('agent-')) as AgentIconName[]

/** All available skill icon names */
export const SKILL_ICON_NAMES = Object.keys(ICON_DATA).filter((k) => k.startsWith('skill-')) as SkillIconName[]

// ─── Component ─────────────────────────────────────────────────────

/** Check if a name is an Iconify "prefix:name" format */
function isIconifyFormat(name: string): boolean {
  return name.includes(':')
}

/**
 * Parse an icon value that may contain an embedded color.
 * Format: "iconName" or "iconName#hexcolor"
 * Examples: "mdi:chat", "mdi:chat#ff5733", "agent-robot#3B82F6"
 */
export function parseIconValue(value: string): { name: string; color?: string } {
  const hashIdx = value.lastIndexOf('#')
  if (hashIdx > 0 && /^[0-9a-fA-F]{3,8}$/.test(value.slice(hashIdx + 1))) {
    return { name: value.slice(0, hashIdx), color: '#' + value.slice(hashIdx + 1) }
  }
  return { name: value }
}

/**
 * Validate that a colour string is a safe CSS colour (hex, rgb/rgba/hsl/hsla,
 * or a known keyword) before splicing it into raw SVG markup. Without this,
 * a crafted value such as `"/><script>…</script>` would XSS the renderer
 * since the SVG body is injected via dangerouslySetInnerHTML.
 *
 * Keyword colours are matched against an explicit allowlist (CSS Level 4
 * named colours plus a couple of CSS-wide keywords) rather than a generic
 * `[a-zA-Z]+` pattern, to avoid accepting arbitrary identifiers.
 */
const SAFE_CSS_COLOR_KEYWORDS = new Set<string>([
  'currentcolor', 'transparent', 'inherit', 'initial', 'unset', 'revert',
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure',
  'beige', 'bisque', 'black', 'blanchedalmond', 'blue', 'blueviolet', 'brown', 'burlywood',
  'cadetblue', 'chartreuse', 'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson', 'cyan',
  'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki',
  'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon',
  'darkseagreen', 'darkslateblue', 'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet',
  'deeppink', 'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue',
  'firebrick', 'floralwhite', 'forestgreen', 'fuchsia',
  'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'gray', 'green', 'greenyellow', 'grey',
  'honeydew', 'hotpink',
  'indianred', 'indigo', 'ivory',
  'khaki',
  'lavender', 'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan',
  'lightgoldenrodyellow', 'lightgray', 'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon',
  'lightseagreen', 'lightskyblue', 'lightslategray', 'lightslategrey', 'lightsteelblue',
  'lightyellow', 'lime', 'limegreen', 'linen',
  'magenta', 'maroon', 'mediumaquamarine', 'mediumblue', 'mediumorchid', 'mediumpurple',
  'mediumseagreen', 'mediumslateblue', 'mediumspringgreen', 'mediumturquoise', 'mediumvioletred',
  'midnightblue', 'mintcream', 'mistyrose', 'moccasin',
  'navajowhite', 'navy',
  'oldlace', 'olive', 'olivedrab', 'orange', 'orangered', 'orchid',
  'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred', 'papayawhip', 'peachpuff',
  'peru', 'pink', 'plum', 'powderblue', 'purple',
  'rebeccapurple', 'red', 'rosybrown', 'royalblue',
  'saddlebrown', 'salmon', 'sandybrown', 'seagreen', 'seashell', 'sienna', 'silver', 'skyblue',
  'slateblue', 'slategray', 'slategrey', 'snow', 'springgreen', 'steelblue',
  'tan', 'teal', 'thistle', 'tomato', 'turquoise',
  'violet',
  'wheat', 'white', 'whitesmoke',
  'yellow', 'yellowgreen',
])

// Per-component CSS number / percentage / alpha sub-patterns used to
// build the rgb()/rgba()/hsl()/hsla() validators below. Keeping these
// strict is important — the sanitised value is spliced verbatim into raw
// SVG markup, so an overly permissive regex (e.g. one that admits
// `rgba(0.0.0.0)` or stray characters) would re-open the XSS vector that
// `dangerouslySetInnerHTML` exposes.
const NUM = String.raw`-?\d+(?:\.\d+)?`
const PCT = String.raw`-?\d+(?:\.\d+)?%`
const NUM_OR_PCT = `(?:${NUM}|${PCT})`
const ALPHA = `(?:${NUM}|${PCT})`
const SAFE_RGB_RE = new RegExp(
  `^rgba?\\(\\s*${NUM_OR_PCT}\\s*,\\s*${NUM_OR_PCT}\\s*,\\s*${NUM_OR_PCT}(?:\\s*,\\s*${ALPHA})?\\s*\\)$`,
)
const SAFE_HSL_RE = new RegExp(
  `^hsla?\\(\\s*${NUM}(?:deg|rad|grad|turn)?\\s*,\\s*${PCT}\\s*,\\s*${PCT}(?:\\s*,\\s*${ALPHA})?\\s*\\)$`,
)
const SAFE_HEX_RE = /^#[0-9a-fA-F]{3,8}$/

function safeCssColor(input: string | undefined, fallback: string): string {
  if (!input) return fallback
  const trimmed = input.trim()
  if (SAFE_HEX_RE.test(trimmed)) return trimmed
  if (SAFE_RGB_RE.test(trimmed)) return trimmed
  if (SAFE_HSL_RE.test(trimmed)) return trimmed
  if (SAFE_CSS_COLOR_KEYWORDS.has(trimmed.toLowerCase())) return trimmed
  return fallback
}

interface IconifyIconProps {
  /** Icon name: preset ("agent-robot") or iconify ("mdi:home") */
  name: string
  /** Icon size in pixels (default: 20) */
  size?: number
  /** Optional CSS class */
  className?: string
  /** Override the default color. Pass 'currentColor' to inherit from parent. */
  color?: string
}

/**
 * Renders an icon – from built-in presets or from the Iconify offline registry.
 * For Iconify icons, the collection must have been loaded via iconService first.
 */
export function IconifyIcon({ name: rawName, size = 20, className, color }: IconifyIconProps) {
  // Parse embedded color from "icon#hex" format
  const parsed = parseIconValue(rawName)
  const name = parsed.name
  const resolvedColor = color ?? parsed.color

  // Case 1: Iconify format (e.g. "mdi:home", "lucide:settings")
  if (isIconifyFormat(name)) {
    return (
      <OfflineIcon
        icon={name}
        width={size}
        height={size}
        className={className}
        style={resolvedColor ? { color: resolvedColor } : undefined}
      />
    )
  }

  // Case 2: Built-in preset icons
  const data = ICON_DATA[name]
  if (!data) {
    // Fallback: empty placeholder
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
        <rect x="2" y="2" width="20" height="20" rx="4" fill="#E5E7EB" />
      </svg>
    )
  }

  const fillColor = safeCssColor(resolvedColor ?? data.color, 'currentColor')

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${data.vw} ${data.vh}`}
      className={className}
      dangerouslySetInnerHTML={{ __html: data.body.replace(/currentColor/g, fillColor) }}
    />
  )
}

// ─── Mapping helpers for existing code ─────────────────────────────

/** Render an avatar – supports both preset names and iconify format */
export function AgentAvatar({ avatar, size = 20 }: { avatar?: string; size?: number }) {
  const raw = avatar || 'agent-robot'
  const { name } = parseIconValue(raw)
  // Iconify format or known preset – pass raw to preserve embedded color
  if (isIconifyFormat(name) || ICON_DATA[name]) {
    return <IconifyIcon name={raw} size={size} />
  }
  // Fallback to robot SVG
  return <IconifyIcon name="agent-robot" size={size} />
}

/** Render a skill icon – supports both preset names and iconify format */
export function SkillIcon({ icon, size = 16 }: { icon?: string; size?: number }) {
  if (icon) {
    const { name } = parseIconValue(icon)
    if (isIconifyFormat(name) || ICON_DATA[name]) {
      return <IconifyIcon name={icon} size={size} />
    }
  }
  // Fallback to wrench SVG
  return <IconifyIcon name="ui-wrench" size={size} />
}

/** Map a skill ID to its icon name */
export function getSkillIconName(skillId: string): string | undefined {
  const mapping: Record<string, string> = {
    'builtin-filesystem':           'lucide:folder-open#F59E0B',
    'builtin-shell':                'lucide:terminal#10B981',
    'builtin-web':                  'lucide:globe#3B82F6',
    'builtin-utilities':            'lucide:wrench#8B5CF6',
    'builtin-todo':                 'lucide:list-checks#06B6D4',
    'builtin-timer':                'lucide:timer#F97316',
    'builtin-memory':               'lucide:brain#EC4899',
    'builtin-browser':              'lucide:app-window#6366F1',
    'builtin-agent-comm':           'lucide:messages-square#14B8A6',
    'builtin-event-automation':     'lucide:zap#EAB308',
    'builtin-self-evolution':       'lucide:sparkles#A855F7',
    'builtin-file-attachment':      'lucide:paperclip#78716C',
    'builtin-git':                  'lucide:git-branch#F43F5E',
    'builtin-code-analysis':        'lucide:scan-search#3B82F6',
    'builtin-advanced-interaction': 'lucide:mouse-pointer-click#8B5CF6',
    'builtin-channels':             'lucide:radio#06B6D4',
    'builtin-email':                'lucide:mail#EF4444',
    'builtin-system-management':    'lucide:settings#6B7280',
    'mp-code-review':               'lucide:file-check#10B981',
    'mp-devops':                    'lucide:rocket#F97316',
    'mp-research':                  'lucide:search#3B82F6',
    'mp-file-manager':              'lucide:files#F59E0B',
    'mp-sysadmin':                  'lucide:shield#EF4444',
  }
  return mapping[skillId]
}

/** Hook to ensure the lucide icon collection is loaded for skill icons */
export function useSkillIconsReady(): boolean {
  const [ready, setReady] = useState(isCollectionLoaded('lucide'))

  useEffect(() => {
    if (ready) return
    let cancelled = false
    loadIconCollection('lucide').then(() => {
      if (!cancelled) setReady(true)
    }).catch(() => {
      // Failed to load, but let the UI render anyway
      if (!cancelled) setReady(true)
    })
    return () => { cancelled = true }
  }, [ready])

  return ready
}

/** Map a channel platform type to its icon name */
export function getChannelIconName(platform: string): string {
  const mapping: Record<string, string> = {
    'wechat':             'simple-icons:wechat',
    'wechat_personal':    'simple-icons:wechat',
    'wechat_official':    'ri:wechat-channels-fill',
    'wechat_miniprogram': 'ri:mini-program-fill',
    'feishu':             'channel-feishu',
    'dingtalk':           'channel-dingtalk',
    'slack':              'simple-icons:slack',
    'telegram':           'simple-icons:telegram',
    'discord':            'simple-icons:discord',
    'teams':              'simple-icons:microsoftteams',
    'custom':             'channel-custom',
  }
  return mapping[platform] || 'channel-custom'
}
