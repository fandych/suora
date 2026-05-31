import { parseChatControlCommand, type ChatControlCommand } from './chatControlCommands'
import { parseShortcutCommand, type ShortcutCommand } from './shortcutCommands'
import { t } from './i18n'

export type SlashCommandResult =
  | { kind: 'control'; command: ChatControlCommand }
  | { kind: 'shortcut'; command: ShortcutCommand }

/**
 * Dispatch a raw user input into either a session-control command
 * (/clear, /help, /model, /agent use ...) or a builder shortcut
 * (/pipeline create ..., /timer create ..., /document create ..., etc.).
 *
 * Chat-control commands take precedence over shortcut commands so that
 * `/agent use X` is always treated as "pin agent" rather than as a builder
 * shortcut (the shortcut parser does not currently match `use`, but we lock
 * the precedence here for safety).
 */
export function dispatchSlashCommand(input: string): SlashCommandResult | null {
  if (typeof input !== 'string') return null
  const control = parseChatControlCommand(input)
  if (control) return { kind: 'control', command: control }

  const shortcut = parseShortcutCommand(input)
  if (shortcut) return { kind: 'shortcut', command: shortcut }

  return null
}

function format(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`)
}

export function formatSlashMessage(key: string, vars: Record<string, string> = {}): string {
  return format(t(key, key), vars)
}

/**
 * Build a human-readable help message listing every supported slash command,
 * derived from the dispatcher itself so the docs and the runtime never drift.
 */
export function buildSlashCommandHelp(): string {
  const lines: string[] = []
  lines.push(t('slash.helpHeading'))
  lines.push('')
  lines.push(t('slash.helpControl'))
  lines.push(`  • ${t('slash.helpClear')}`)
  lines.push(`  • ${t('slash.helpModel')}`)
  lines.push(`  • ${t('slash.helpAgent')}`)
  lines.push('')
  lines.push(t('slash.helpShortcut'))
  for (const domain of ['agent', 'channel', 'document', 'pipeline', 'timer'] as const) {
    lines.push(
      `  • ${format(t('slash.helpShortcutLine'), { domain, action: 'create|update|delete' })}`,
    )
  }
  lines.push(`  ${t('slash.helpDomains')}`)
  lines.push(`  ${t('slash.helpActions')}`)
  lines.push('')
  lines.push(t('slash.helpFooter'))
  return lines.join('\n')
}
