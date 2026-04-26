/**
 * Icon Service - Manages offline Iconify icon collections.
 * Loads icon data from @iconify/json via IPC (main process reads JSON files).
 * Registers collections with @iconify/react for offline rendering.
 */
import { addCollection } from '@iconify/react'
import type { IconifyJSON } from '@iconify/types'

// ─── Types ─────────────────────────────────────────────────────────

export interface IconCollectionMeta {
  prefix: string
  name: string
  total: number
  category?: string
}

// ─── State ─────────────────────────────────────────────────────────

/** Collections whose JSON data has been loaded & registered */
const loadedCollections = new Set<string>()

/** Cached collection metadata */
let collectionsCache: IconCollectionMeta[] | null = null

/** Cached icon names per collection prefix */
const iconNamesCache = new Map<string, string[]>()

type IconElectronBridge = {
  invoke?: (channel: string, ...args: unknown[]) => Promise<unknown>
}

function getElectronBridge(): IconElectronBridge | undefined {
  return (window as unknown as { electron?: IconElectronBridge }).electron
}

// ─── Public API ────────────────────────────────────────────────────

/** List all available icon collections (metadata only) */
export async function listIconCollections(): Promise<IconCollectionMeta[]> {
  if (collectionsCache) return collectionsCache
  const electron = getElectronBridge()
  if (!electron?.invoke) return []
  const result = await electron.invoke('iconify:listCollections') as IconCollectionMeta[]
  collectionsCache = result
  return result
}

/** Load a specific icon collection so its icons can be rendered offline */
export async function loadIconCollection(prefix: string): Promise<void> {
  if (loadedCollections.has(prefix)) return
  const electron = getElectronBridge()
  if (!electron?.invoke) return
  const data = await electron.invoke('iconify:loadCollection', prefix) as IconifyJSON | null
  if (data) {
    addCollection(data)
    loadedCollections.add(prefix)
    if (data.icons) {
      iconNamesCache.set(prefix, Object.keys(data.icons))
    }
  }
}

/** Get icon names for a loaded collection */
export async function getIconNames(prefix: string): Promise<string[]> {
  const cachedNames = iconNamesCache.get(prefix)
  if (cachedNames !== undefined) return cachedNames
  // Need to load collection first
  const electron = getElectronBridge()
  if (!electron?.invoke) return []
  const data = await electron.invoke('iconify:getIconNames', prefix) as string[]
  iconNamesCache.set(prefix, data)
  return data
}

/** Search icons by keyword across a specific collection */
export async function searchIcons(prefix: string, query: string, limit = 100): Promise<string[]> {
  const names = await getIconNames(prefix)
  if (!query.trim()) return names.slice(0, limit)
  const q = query.toLowerCase()
  return names.filter(n => n.toLowerCase().includes(q)).slice(0, limit)
}

/** Check if a collection is loaded */
export function isCollectionLoaded(prefix: string): boolean {
  return loadedCollections.has(prefix)
}

/** Pre-load popular icon collections for quick access */
export async function preloadPopularCollections(): Promise<void> {
  const popular = ['mdi', 'lucide', 'ph', 'tabler', 'ri']
  await Promise.all(popular.map(p => loadIconCollection(p)))
}

/** Featured/recommended collections for the icon picker */
export const FEATURED_COLLECTIONS = [
  'mdi',              // Material Design Icons (~7000)
  'lucide',           // Lucide (~1500)
  'ph',               // Phosphor (~7000)
  'tabler',           // Tabler (~4500)
  'ri',               // Remix Icons (~2500)
  'carbon',           // Carbon (~2000)
  'heroicons',        // Heroicons (~600)
  'bi',               // Bootstrap Icons (~2000)
  'fa6-solid',        // Font Awesome 6 Solid (~1400)
  'fa6-regular',      // Font Awesome 6 Regular (~160)
  'solar',            // Solar (~7000)
  'fluent',           // Fluent UI (~5000)
  'material-symbols', // Material Symbols (~8000)
  'ion',              // Ionicons (~1300)
  'octicon',          // Octicons (~500)
]
