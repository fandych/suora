/**
 * IconPicker - A modal component for browsing and selecting Iconify icons.
 *
 * Supports both built-in preset icons and icons from any loaded Iconify collection.
 * Collections are loaded lazily from @iconify/json via the icon service.
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { Icon as OfflineIcon } from '@iconify/react'
import { useI18n } from '@/hooks/useI18n'
import { ICON_DATA, IconifyIcon as PresetIcon, parseIconValue } from './IconifyIcons'
import {
  listIconCollections,
  loadIconCollection,
  searchIcons,
  isCollectionLoaded,
  FEATURED_COLLECTIONS,
  type IconCollectionMeta,
} from '@/services/iconService'

// ─── Types ─────────────────────────────────────────────────────────

interface IconPickerProps {
  /** Currently selected icon name */
  value?: string
  /** Callback when an icon is selected */
  onSelect: (iconName: string) => void
  /** Close the picker */
  onClose: () => void
  /** Filter to only show preset icons matching this prefix (e.g. "agent-", "skill-") */
  presetFilter?: string
}

// ─── Tabs ──────────────────────────────────────────────────────────

type TabId = 'presets' | 'iconify'

// ─── Color palette ─────────────────────────────────────────────────

const COLOR_PALETTE = [
  '', // no color (use default)
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#84CC16', '#22C55E', '#10B981', '#14B8A6',
  '#06B6D4', '#0EA5E9', '#3B82F6', '#6366F1',
  '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
  '#F43F5E', '#78716C', '#6B7280', '#1F2937',
]

// ─── Component ─────────────────────────────────────────────────────

export function IconPicker({ value, onSelect, onClose, presetFilter }: IconPickerProps) {
  const { t } = useI18n()

  // Parse initial value
  const initialParsed = value ? parseIconValue(value) : { name: '', color: undefined }

  const [tab, setTab] = useState<TabId>('presets')
  const [searchQuery, setSearchQuery] = useState('')
  const [collections, setCollections] = useState<IconCollectionMeta[]>([])
  const [selectedCollection, setSelectedCollection] = useState<string>(FEATURED_COLLECTIONS[0])
  const [iconNames, setIconNames] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [collectionLoading, setCollectionLoading] = useState(false)
  const [selectedIcon, setSelectedIcon] = useState<string>(initialParsed.name)
  const [selectedColor, setSelectedColor] = useState<string>(initialParsed.color ?? '')
  const [customColor, setCustomColor] = useState(initialParsed.color ?? '')
  const backdropRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Load available collections on mount
  useEffect(() => {
    listIconCollections().then(setCollections).catch(() => {})
  }, [])

  // Focus search input when active tab changes
  useEffect(() => {
    searchRef.current?.focus()
  }, [tab])

  // Load icons when collection changes or search changes
  useEffect(() => {
    if (tab !== 'iconify') return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        if (!isCollectionLoaded(selectedCollection)) {
          setCollectionLoading(true)
          await loadIconCollection(selectedCollection)
          setCollectionLoading(false)
        }
        const names = await searchIcons(selectedCollection, searchQuery, 200)
        if (!cancelled) setIconNames(names)
      } catch {
        if (!cancelled) setIconNames([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [tab, selectedCollection, searchQuery])

  // Filter preset icons
  const presetIcons = Object.keys(ICON_DATA).filter(name => {
    if (presetFilter && !name.startsWith(presetFilter)) return false
    if (searchQuery) return name.toLowerCase().includes(searchQuery.toLowerCase())
    return true
  })

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose()
  }, [onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  /** Build the final icon value with optional color suffix */
  const buildIconValue = useCallback((icon: string, color: string) => {
    if (!icon) return ''
    return color ? `${icon}${color.replace('#', '#')}` : icon
  }, [])

  /** Handle clicking an icon in the grid */
  const handleIconClick = useCallback((iconName: string) => {
    setSelectedIcon(iconName)
  }, [])

  /** Handle confirm (select) button */
  const handleConfirm = useCallback(() => {
    if (!selectedIcon) return
    onSelect(buildIconValue(selectedIcon, selectedColor))
  }, [selectedIcon, selectedColor, onSelect, buildIconValue])

  // Get featured collections from the loaded list
  const featuredCollections = collections.filter(c => FEATURED_COLLECTIONS.includes(c.prefix))
  const otherCollections = collections.filter(c => !FEATURED_COLLECTIONS.includes(c.prefix))

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="w-[600px] max-h-[580px] bg-surface-1 border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <h3 className="text-sm font-semibold text-text-primary">
            {t('icons.pickIcon', 'Choose Icon')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-md text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 pt-3">
          <button
            type="button"
            onClick={() => setTab('presets')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === 'presets'
                ? 'bg-accent/15 text-accent'
                : 'text-text-muted hover:text-text-secondary hover:bg-surface-2'
            }`}
          >
            {t('icons.presets', 'Presets')}
          </button>
          <button
            type="button"
            onClick={() => setTab('iconify')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === 'iconify'
                ? 'bg-accent/15 text-accent'
                : 'text-text-muted hover:text-text-secondary hover:bg-surface-2'
            }`}
          >
            {t('icons.iconify', 'Iconify Library')}
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('icons.search', 'Search icons...')}
            className="w-full px-3 py-2 bg-surface-0 border border-border-subtle rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {tab === 'presets' ? (
            /* Preset icons grid */
            <div className="flex-1 overflow-y-auto p-4">
              {presetIcons.length === 0 ? (
                <p className="text-xs text-text-muted text-center py-8">
                  {t('icons.noResults', 'No icons found')}
                </p>
              ) : (
                <div className="grid grid-cols-8 gap-1.5">
                  {presetIcons.map((name) => (
                    <button
                      key={name}
                      type="button"
                      title={name}
                      onClick={() => handleIconClick(name)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                        selectedIcon === name
                          ? 'bg-accent/20 ring-2 ring-accent scale-110'
                          : 'bg-surface-2 hover:bg-surface-3'
                      }`}
                    >
                      <PresetIcon name={name} size={20} color={selectedIcon === name && selectedColor ? selectedColor : undefined} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Iconify collections + icons */
            <>
              {/* Collections sidebar */}
              <div className="w-[170px] border-r border-border-subtle overflow-y-auto py-2 px-2 shrink-0">
                {featuredCollections.length > 0 && (
                  <>
                    <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-2 mb-1">
                      {t('icons.featured', 'Featured')}
                    </p>
                    {featuredCollections.map((c) => (
                      <button
                        key={c.prefix}
                        type="button"
                        onClick={() => setSelectedCollection(c.prefix)}
                        className={`w-full text-left px-2 py-1.5 text-xs rounded-md mb-0.5 transition-colors truncate ${
                          selectedCollection === c.prefix
                            ? 'bg-accent/15 text-accent font-medium'
                            : 'text-text-secondary hover:bg-surface-2'
                        }`}
                      >
                        {c.name} <span className="text-text-muted">({c.total})</span>
                      </button>
                    ))}
                  </>
                )}
                {otherCollections.length > 0 && (
                  <>
                    <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-2 mt-3 mb-1">
                      {t('icons.all', 'All')}
                    </p>
                    {otherCollections.map((c) => (
                      <button
                        key={c.prefix}
                        type="button"
                        onClick={() => setSelectedCollection(c.prefix)}
                        className={`w-full text-left px-2 py-1.5 text-xs rounded-md mb-0.5 transition-colors truncate ${
                          selectedCollection === c.prefix
                            ? 'bg-accent/15 text-accent font-medium'
                            : 'text-text-secondary hover:bg-surface-2'
                        }`}
                      >
                        {c.name} <span className="text-text-muted">({c.total})</span>
                      </button>
                    ))}
                  </>
                )}
              </div>

              {/* Icons grid */}
              <div className="flex-1 overflow-y-auto p-3">
                {collectionLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                    <span className="ml-2 text-xs text-text-muted">
                      {t('icons.loading', 'Loading collection...')}
                    </span>
                  </div>
                ) : loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                  </div>
                ) : iconNames.length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-8">
                    {t('icons.noResults', 'No icons found')}
                  </p>
                ) : (
                  <div className="grid grid-cols-7 gap-1.5">
                    {iconNames.map((name) => {
                      const fullName = `${selectedCollection}:${name}`
                      return (
                        <button
                          key={name}
                          type="button"
                          title={fullName}
                          onClick={() => handleIconClick(fullName)}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                            selectedIcon === fullName
                              ? 'bg-accent/20 ring-2 ring-accent scale-110'
                              : 'bg-surface-2 hover:bg-surface-3'
                          }`}
                        >
                          <OfflineIcon icon={fullName} width={20} height={20} className="text-text-primary" style={selectedIcon === fullName && selectedColor ? { color: selectedColor } : undefined} />
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer: color picker + selected icon preview + confirm */}
        <div className="border-t border-border-subtle bg-surface-0/50">
          {/* Color palette */}
          {selectedIcon && (
            <div className="px-4 pt-3 pb-2">
              <label className="block text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1.5">
                {t('icons.color', 'Color')}
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c || 'default'}
                    type="button"
                    title={c || t('icons.defaultColor', 'Default')}
                    onClick={() => { setSelectedColor(c); setCustomColor(c) }}
                    className={`w-6 h-6 rounded-full border-2 transition-all shrink-0 ${
                      selectedColor === c
                        ? 'border-accent scale-110 shadow-md'
                        : 'border-transparent hover:border-border'
                    } ${!c ? 'bg-gradient-to-br from-surface-3 to-surface-1' : ''}`}
                    style={c ? { backgroundColor: c } : undefined}
                  >
                    {!c && selectedColor === '' && (
                      <span className="block w-full h-full rounded-full border-2 border-accent" />
                    )}
                  </button>
                ))}
                {/* Custom color input */}
                <div className="flex items-center gap-1 ml-1">
                  <input
                    type="color"
                    value={customColor || '#6366F1'}
                    onChange={(e) => {
                      setCustomColor(e.target.value)
                      setSelectedColor(e.target.value)
                    }}
                    className="w-6 h-6 rounded-full border-0 cursor-pointer bg-transparent p-0"
                    title={t('icons.customColor', 'Custom color')}
                  />
                </div>
              </div>
            </div>
          )}
          {/* Preview + confirm */}
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2">
              {selectedIcon ? (
                <>
                  <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center">
                    {selectedIcon.includes(':') ? (
                      <OfflineIcon icon={selectedIcon} width={20} height={20} style={selectedColor ? { color: selectedColor } : undefined} className="text-text-primary" />
                    ) : (
                      <PresetIcon name={selectedIcon} size={20} color={selectedColor || undefined} />
                    )}
                  </div>
                  <code className="text-xs text-text-secondary font-mono">{selectedIcon}{selectedColor ? ` ${selectedColor}` : ''}</code>
                </>
              ) : (
                <span className="text-xs text-text-muted">{t('icons.noneSelected', 'No icon selected')}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs rounded-md text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!selectedIcon}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('common.confirm', 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
