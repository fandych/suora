/**
 * Channel platform icons – renders via Iconify offline icons where available,
 * falling back to inline SVG presets for platforms without Iconify coverage.
 *
 * Collections used: simple-icons, ri (Remix Icons).
 * For Feishu and DingTalk (no Iconify icon exists), inline SVGs are kept.
 */
import { useEffect, useState } from 'react'
import { Icon as OfflineIcon } from '@iconify/react'
import { ICON_DATA, IconifyIcon as PresetIcon, parseIconValue } from '@/components/icons/IconifyIcons'
import { loadIconCollection, isCollectionLoaded } from '@/services/iconService'

// ─── Platform → Iconify icon mapping ───────────────────────────────

interface ChannelIconDef {
  /** Iconify icon name (e.g. "simple-icons:wechat") or preset name */
  icon: string
  /** Brand color */
  color: string
  /** Which iconify collection needs to be loaded (undefined = ICON_DATA preset) */
  collection?: string
}

const CHANNEL_ICONS: Record<string, ChannelIconDef> = {
  feishu:              { icon: 'channel-feishu',               color: '#3370FF' },
  dingtalk:            { icon: 'channel-dingtalk',             color: '#0089FF' },
  wechat:              { icon: 'simple-icons:wechat',          color: '#07C160', collection: 'simple-icons' },
  wechat_official:     { icon: 'ri:wechat-channels-fill',      color: '#07C160', collection: 'ri' },
  wechat_miniprogram:  { icon: 'ri:mini-program-fill',         color: '#07C160', collection: 'ri' },
  slack:               { icon: 'simple-icons:slack',            color: '#4A154B', collection: 'simple-icons' },
  telegram:            { icon: 'simple-icons:telegram',         color: '#26A5E4', collection: 'simple-icons' },
  discord:             { icon: 'simple-icons:discord',          color: '#5865F2', collection: 'simple-icons' },
  teams:               { icon: 'simple-icons:microsoftteams',   color: '#6264A7', collection: 'simple-icons' },
  custom:              { icon: 'channel-custom',                color: '#6B7280' },
}

/** Collections that channel icons depend on */
const REQUIRED_COLLECTIONS = ['simple-icons', 'ri']

// ─── Collection loader hook ────────────────────────────────────────

let collectionsLoaded = false

/**
 * Ensures the icon collections required by channel icons are loaded.
 * Call once near the root of the channel UI tree.
 */
export function useChannelIconCollections() {
  const [ready, setReady] = useState(collectionsLoaded)

  useEffect(() => {
    if (collectionsLoaded) return
    let cancelled = false

    Promise.all(
      REQUIRED_COLLECTIONS
        .filter(c => !isCollectionLoaded(c))
        .map(c => loadIconCollection(c))
    ).then(() => {
      collectionsLoaded = true
      if (!cancelled) setReady(true)
    }).catch(() => {})

    return () => { cancelled = true }
  }, [])

  return ready
}

// ─── Main component ────────────────────────────────────────────────

interface IconProps {
  size?: number
  className?: string
}

export function ChannelPlatformIcon({ platform, size = 20, className, customIcon }: IconProps & { platform: string; customIcon?: string }) {
  // Custom channel: use user-selected icon
  if (platform === 'custom') {
    if (!customIcon) {
      return <PresetIcon name="channel-custom" size={size} className={className} />
    }
    const { name: iconName, color: iconColor } = parseIconValue(customIcon)
    if (iconName.includes(':')) {
      return <OfflineIcon icon={iconName} width={size} height={size} className={className} style={iconColor ? { color: iconColor } : undefined} />
    }
    if (ICON_DATA[iconName]) {
      return <PresetIcon name={iconName} size={size} className={className} color={iconColor} />
    }
    return <span className="text-sm leading-none">{iconName}</span>
  }

  // Known platform
  const def = CHANNEL_ICONS[platform]
  if (!def) {
    return <PresetIcon name="channel-custom" size={size} className={className} />
  }

  // Iconify icon (from loaded collection)
  if (def.collection) {
    return (
      <OfflineIcon
        icon={def.icon}
        width={size}
        height={size}
        className={className}
        style={{ color: def.color }}
      />
    )
  }

  // Preset icon (inline SVG from ICON_DATA)
  return <PresetIcon name={def.icon} size={size} className={className} />
}

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Get a short display name for a channel platform
 */
export function getPlatformDisplayName(platform: string): string {
  switch (platform) {
    case 'feishu': return 'Feishu (飞书)'
    case 'dingtalk': return 'DingTalk (钉钉)'
    case 'wechat': return 'WeChat Work (企业微信)'
    case 'wechat_official': return 'WeChat Official (公众号)'
    case 'wechat_miniprogram': return 'WeChat Mini (小程序)'
    case 'slack': return 'Slack'
    case 'telegram': return 'Telegram'
    case 'discord': return 'Discord'
    case 'teams': return 'Microsoft Teams'
    case 'custom': return 'Custom'
    default: return platform
  }
}

/**
 * Get the iconify icon name for a channel platform
 */
export function getChannelIconName(platform: string): string {
  return CHANNEL_ICONS[platform]?.icon ?? 'channel-custom'
}

/**
 * Get the brand color for a channel platform
 */
export function getChannelIconColor(platform: string): string {
  return CHANNEL_ICONS[platform]?.color ?? '#6B7280'
}
