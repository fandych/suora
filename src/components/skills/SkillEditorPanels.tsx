import { useEffect, useMemo, useState, useCallback } from 'react'
import { useAppStore } from '@/store/appStore'
import { generateId } from '@/utils/helpers'
import { IconifyIcon } from '@/components/icons/IconifyIcons'
import { MarkdownContent } from '@/components/chat/ChatMarkdown'
import { useI18n } from '@/hooks/useI18n'
import type { Skill, SkillVersion, SkillDependency } from '@/types'
import { builtinToolDefs, BUILTIN_TOOL_DESCRIPTIONS } from '@/services/tools'
import { compileCustomCode, type CompileResult } from '@/services/customSkillRuntime'
import { auditCustomCode, signSkill, verifySkillSignature, getAuditLog, type SecurityFinding, type AuditLogEntry } from '@/services/skillSecurity'
import { confirm } from '@/services/confirmDialog'
import {
  settingsInputClass,
  settingsLabelClass,
  settingsMonoInputClass,
  settingsPrimaryButtonClass,
  settingsSecondaryButtonClass,
  settingsSelectClass,
  settingsSoftButtonClass,
  settingsTextAreaClass,
} from '@/components/settings/panelUi'

// ─── Constants ────────────────────────────────────────────────────

export const TOOL_DESCRIPTIONS = BUILTIN_TOOL_DESCRIPTIONS
export const BUILTIN_TOOL_OPTIONS = Object.keys(builtinToolDefs)

const CUSTOM_CODE_PLACEHOLDER = `// Define custom tools using defineCustomTool()
defineCustomTool({
  name: 'calculate',
  description: 'Perform a math calculation',
  params: {
    expression: { type: 'string', description: 'Math expression', required: true }
  },
  execute: async ({ expression }) => {
    try {
      const result = Function('"use strict"; return (' + expression + ')')()
      return 'Result: ' + result
    } catch (e) {
      return 'Error: ' + String(e)
    }
  }
})`
const panelSelectClass = settingsSelectClass
const panelMonoInputClass = settingsMonoInputClass
const panelTextAreaClass = settingsTextAreaClass
const panelCompactInputClass = `${settingsInputClass} rounded-xl px-3 py-2 text-xs`
const panelCompactSelectClass = `${settingsSelectClass} rounded-xl px-3 py-2 text-xs`
const panelCompactButtonClass = `${settingsSoftButtonClass} rounded-xl px-3 py-2 text-xs`
const panelCompactSecondaryButtonClass = `${settingsSecondaryButtonClass} rounded-xl px-3 py-2 text-xs`

// ─── Markdown editor with Edit / Preview tabs ─────────────────────

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 10,
  disabled,
  fillHeight = false,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  disabled?: boolean
  fillHeight?: boolean
}) {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const { t } = useI18n()
  const isPreview = mode === 'preview'

  return (
    <div className={`overflow-hidden rounded-[28px] border border-border-subtle/60 bg-linear-to-br from-surface-2/82 via-surface-2/76 to-surface-3/58 shadow-[0_18px_40px_rgba(15,23,42,0.08)] ${fillHeight ? 'flex min-h-168 flex-col' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle/55 bg-surface-3/30 px-3 py-2.5">
        <div className="inline-flex rounded-2xl border border-border-subtle bg-surface-0/65 p-1 text-[11px]">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={`rounded-xl px-3 py-1.5 transition-colors ${mode === 'edit' ? 'bg-accent/15 text-accent font-medium' : 'text-text-muted hover:text-text-secondary'}`}
          >
            {t('skills.edit', 'Edit')}
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={`rounded-xl px-3 py-1.5 transition-colors ${mode === 'preview' ? 'bg-accent/15 text-accent font-medium' : 'text-text-muted hover:text-text-secondary'}`}
          >
            {t('skills.preview', 'Preview')}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {isPreview && (
            <span className="rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
              Live render
            </span>
          )}
          <span className="rounded-full border border-border-subtle/45 bg-surface-0/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted/75">
            Markdown
          </span>
        </div>
      </div>
      {mode === 'edit' ? (
        <div className={`p-3 ${fillHeight ? 'min-h-0 flex-1' : ''}`}>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={fillHeight ? undefined : rows}
            disabled={disabled}
            className={`w-full rounded-[26px] border border-border-subtle/55 bg-surface-0/55 px-4 py-4 font-mono text-sm leading-7 text-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] placeholder-text-muted focus:border-accent/35 focus:outline-none disabled:opacity-50 ${fillHeight ? 'min-h-0 h-full flex-1 resize-none' : 'min-h-72 resize-y'}`}
          />
        </div>
      ) : (
        <div className={`overflow-auto px-4 py-4 text-sm text-text-primary ${fillHeight ? 'min-h-0 flex-1' : 'min-h-24'}`}>
          {value.trim() ? (
            <div className={`rounded-[26px] border border-border-subtle/55 bg-surface-0/55 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] ${fillHeight ? 'min-h-full' : ''}`}>
              <article className="document-prose markdown-body min-h-full text-text-primary">
                <MarkdownContent content={value} />
              </article>
            </div>
          ) : (
            <div className="flex min-h-52 items-center justify-center rounded-[26px] border border-dashed border-border-subtle/60 bg-surface-0/35 px-5 text-center text-xs text-text-muted">
              {t('skills.nothingToPreview', 'Nothing to preview.')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Skill Test Panel ─────────────────────────────────────────────

export function SkillTestPanel({ skill }: { skill: Skill }) {
  const [selectedTool, setSelectedTool] = useState('')
  const [inputJson, setInputJson] = useState('{}')
  const [output, setOutput] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const { t } = useI18n()

  const toolNames = useMemo(() => {
    const names: string[] = (skill.tools ?? []).map((t: { name: string }) => t.name)
    if (skill.customCode?.trim()) {
      const result = compileCustomCode(skill.customCode)
      names.push(...result.toolNames)
    }
    return [...new Set(names)]
  }, [skill.tools, skill.customCode])

  useEffect(() => {
    if (toolNames.length > 0 && !selectedTool) setSelectedTool(toolNames[0])
  }, [toolNames, selectedTool])

  const handleRun = useCallback(async () => {
    setError(null)
    setOutput(null)
    if (!selectedTool) { setError('No tool selected.'); return }

    let parsedInput: Record<string, unknown>
    try {
      parsedInput = JSON.parse(inputJson)
    } catch {
      setError('Invalid JSON input.')
      return
    }

    setRunning(true)
    try {
      if (skill.customCode?.trim()) {
        const { tools, error: compileError } = compileCustomCode(skill.customCode)
        if (compileError) { setError(compileError); setRunning(false); return }
        const toolDef = tools[selectedTool]
        if (toolDef) {
          const toolAny = toolDef as { execute?: (args: Record<string, unknown>, opts: unknown) => Promise<unknown> }
          if (toolAny.execute) {
            const result = await toolAny.execute(parsedInput, {})
            setOutput(typeof result === 'string' ? result : JSON.stringify(result, null, 2))
            setRunning(false)
            return
          }
        }
      }

      const builtinTool = builtinToolDefs[selectedTool]
      if (builtinTool) {
        const toolAny = builtinTool as { execute?: (args: Record<string, unknown>, opts: unknown) => Promise<unknown> }
        if (toolAny.execute) {
          const result = await toolAny.execute(parsedInput, {})
          setOutput(typeof result === 'string' ? result : JSON.stringify(result, null, 2))
          setRunning(false)
          return
        }
      }

      setError(`Tool "${selectedTool}" does not have an executable handler. It may be a reference-only tool.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }, [selectedTool, inputJson, skill.customCode])

  return (
    <div className="space-y-4">
      <p className="text-xs text-text-muted">
        Test individual tools from this skill by providing JSON input and running them directly.
      </p>

      {toolNames.length === 0 ? (
        <div className="rounded-xl border border-border p-6 text-center">
          <p className="text-sm text-text-muted">{t('skills.noToolsAvailable', 'No tools available. Add tools in the Basic tab or define custom tools in the Custom Code tab.')}</p>
        </div>
      ) : (
        <>
          <div>
            <label className={settingsLabelClass}>{t('skills.selectTool', 'Select Tool')}</label>
            <select
              value={selectedTool}
              onChange={(e) => { setSelectedTool(e.target.value); setOutput(null); setError(null) }}
              aria-label="Select tool"
              className={panelSelectClass}
            >
              {toolNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            {TOOL_DESCRIPTIONS[selectedTool] && (
              <p className="mt-1 text-[11px] text-text-muted">{TOOL_DESCRIPTIONS[selectedTool]}</p>
            )}
          </div>

          <div>
            <label className={settingsLabelClass}>{t('skills.inputJson', 'Input (JSON)')}</label>
            <textarea
              value={inputJson}
              onChange={(e) => setInputJson(e.target.value)}
              rows={5}
              spellCheck={false}
              className={`${panelMonoInputClass} min-h-0 resize-y`}
              placeholder='{ "key": "value" }'
            />
          </div>

          <button
            type="button"
            onClick={handleRun}
            disabled={running || !selectedTool}
            className={settingsPrimaryButtonClass}
          >
            {running ? t('skills.running', '⏳ Running...') : t('skills.runTest', '▶ Run Test')}
          </button>

          {error && (
            <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-danger text-sm font-medium flex items-center gap-1"><IconifyIcon name="ui-close-circle" size={14} color="currentColor" /> {t('skills.error', 'Error')}</span>
              </div>
              <pre className="text-xs text-danger/80 whitespace-pre-wrap font-mono">{error}</pre>
            </div>
          )}

          {output !== null && (
            <div className="rounded-xl border border-success/30 bg-success/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-success text-sm font-medium flex items-center gap-1"><IconifyIcon name="ui-check-circle" size={14} color="currentColor" /> {t('skills.output', 'Output')}</span>
              </div>
              <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono max-h-60 overflow-y-auto">{output}</pre>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Skill Log Panel ──────────────────────────────────────────────

export function SkillLogPanel({ skill }: { skill: Skill }) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [filter, setFilter] = useState<'all' | 'success' | 'error' | 'blocked'>('all')

  const toolNames = useMemo(() => {
    const names = new Set((skill.tools ?? []).map((t: { name: string }) => t.name))
    if (skill.customCode) {
      try {
        const compiled = compileCustomCode(skill.customCode)
        compiled.toolNames.forEach((n) => names.add(n))
      } catch { /* ignore */ }
    }
    return names
  }, [skill.tools, skill.customCode])

  useEffect(() => {
    const all = getAuditLog()
    const filtered = all.filter((e) => toolNames.has(e.toolName))
    setLogs([...filtered].reverse())
  }, [toolNames])

  const displayed = filter === 'all' ? logs : logs.filter((l) => l.status === filter)
  const { t } = useI18n()

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold text-text-primary">{t('skills.executionLogs', 'Execution Logs')}</h4>
        <span className="text-xs text-text-muted">({logs.length} {t('skills.entries', 'entries')})</span>
        <div className="ml-auto flex gap-1">
          {(['all', 'success', 'error', 'blocked'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-2 py-1 rounded-lg text-[11px] capitalize transition-colors ${
                filter === f ? 'bg-accent/15 text-accent font-medium' : 'text-text-muted hover:bg-surface-2'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {displayed.length === 0 ? (
        <div className="text-center py-8 text-text-muted text-sm">
          No {filter === 'all' ? '' : filter + ' '}{t('skills.noLogs', 'log entries found for this skill\'s tools.')}
        </div>
      ) : (
        <div className="space-y-1.5 max-h-100 overflow-y-auto">
          {displayed.map((entry) => (
            <div
              key={entry.id}
              className="px-3 py-2 rounded-lg bg-surface-1 border border-border/50 text-xs"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  entry.status === 'success' ? 'bg-green-500' :
                  entry.status === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                }`} />
                <span className="font-mono font-medium text-text-primary">{entry.toolName}</span>
                {entry.duration != null && (
                  <span className="text-text-muted">{entry.duration}ms</span>
                )}
                <span className="ml-auto text-text-muted">
                  {new Date(entry.timestamp).toLocaleString()}
                </span>
              </div>
              {entry.result && (
                <div className="text-text-muted truncate font-mono text-[10px] mt-0.5">
                  {entry.result.slice(0, 200)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Security Audit Panel ─────────────────────────────────────────

export function SecurityAuditPanel({ skill }: { skill: Skill }) {
  const [findings, setFindings] = useState<SecurityFinding[]>([])
  const [signature, setSignature] = useState<import('@/types').SkillSignature | null>(null)
  const [verified, setVerified] = useState<boolean | null>(null)
  const [signing, setSigning] = useState(false)
  const { t } = useI18n()

  useEffect(() => {
    if (skill.customCode?.trim()) {
      setFindings(auditCustomCode(skill.customCode))
    } else {
      setFindings([])
    }
  }, [skill.customCode])

  const handleSign = async () => {
    setSigning(true)
    try {
      const sig = await signSkill(skill)
      setSignature(sig)
      setVerified(true)
    } finally {
      setSigning(false)
    }
  }

  const handleVerify = async () => {
    if (!signature) return
    const valid = await verifySkillSignature(skill, signature)
    setVerified(valid)
  }

  const severityColors = {
    critical: 'text-danger bg-danger/10 border-danger/30',
    warning: 'text-warning bg-warning/10 border-warning/30',
    info: 'text-accent bg-accent/10 border-accent/30',
  }

  return (
    <div className="space-y-6">
      {/* Skill Signing */}
      <div className="rounded-xl border border-border p-4 bg-surface-0/30">
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-1.5"><IconifyIcon name="ui-fingerprint" size={16} color="currentColor" /> {t('skills.skillSigning', 'Skill Signing')}</h3>
        <p className="text-xs text-text-muted mb-3">
          Sign this skill to create a SHA-256 integrity hash. This can be used to verify the skill hasn&apos;t been tampered with.
        </p>
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={handleSign}
            disabled={signing}
            className="px-4 py-2 rounded-xl bg-accent/15 text-accent text-sm font-medium hover:bg-accent/25 transition-colors border border-accent/30 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            {signing ? t('skills.signing', 'Signing...') : <><IconifyIcon name="ui-sign" size={14} color="currentColor" /> {t('skills.signSkill', 'Sign Skill')}</>}
          </button>
          {signature && (
            <button
              onClick={handleVerify}
              className="px-4 py-2 rounded-xl bg-surface-3 text-text-secondary text-sm font-medium hover:bg-surface-4 transition-colors inline-flex items-center gap-1.5"
            >
              <IconifyIcon name="ui-search" size={14} color="currentColor" /> {t('skills.verify', 'Verify')}
            </button>
          )}
        </div>
        {signature && (
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-text-muted">{t('skills.hash', 'Hash:')}</span>
              <code className="text-text-secondary font-mono text-[10px] break-all">{signature.hash}</code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-text-muted">{t('skills.signed', 'Signed:')}</span>
              <span className="text-text-secondary">{new Date(signature.signedAt).toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-text-muted">{t('common.status', 'Status:')}</span>
              <span className={`px-1.5 py-0.5 rounded ${verified === true ? 'bg-success/15 text-success' : verified === false ? 'bg-danger/15 text-danger' : 'bg-surface-3 text-text-muted'}`}>
                {verified === true ? <><IconifyIcon name="ui-check-circle" size={12} color="currentColor" /> {t('skills.verified', 'Verified')}</> : verified === false ? <><IconifyIcon name="ui-close-circle" size={12} color="currentColor" /> {t('skills.modified', 'Modified')}</> : t('skills.unknown', 'Unknown')}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Code Security Audit */}
      <div className="rounded-xl border border-border p-4 bg-surface-0/30">
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-1.5"><IconifyIcon name="ui-search" size={16} color="currentColor" /> {t('skills.codeAudit', 'Code Security Audit')}</h3>
        {!skill.customCode?.trim() ? (
          <p className="text-xs text-text-muted">{t('skills.noCustomCode', 'No custom code to audit.')}</p>
        ) : findings.length === 0 ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full bg-success" />
            <span className="text-success font-medium">{t('skills.noSecurityIssues', 'No security issues found')}</span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3 mb-3 text-xs">
              <span className="text-text-muted">{findings.length} {t('skills.findings', 'finding(s)')}</span>
              <span className="text-danger font-medium">{findings.filter((f) => f.severity === 'critical').length} {t('skills.critical', 'critical')}</span>
              <span className="text-warning font-medium">{findings.filter((f) => f.severity === 'warning').length} {t('skills.warnings', 'warnings')}</span>
            </div>
            {findings.map((f, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 text-xs rounded-lg border px-3 py-2 ${severityColors[f.severity]}`}
              >
                <span className="shrink-0 font-bold uppercase text-[10px]">
                  {f.severity === 'critical' ? <IconifyIcon name="ui-alert-severe" size={12} color="currentColor" /> : f.severity === 'warning' ? <IconifyIcon name="ui-warning" size={12} color="currentColor" /> : <IconifyIcon name="ui-info" size={12} color="currentColor" />}
                </span>
                <span className="flex-1">{f.message}</span>
                {f.line && <span className="shrink-0 font-mono opacity-60">L{f.line}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Custom Code Editor ───────────────────────────────────────────

export function CustomCodeEditor({ value, onChange, disabled }: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const [testResult, setTestResult] = useState<CompileResult | null>(null)
  const { t } = useI18n()

  const handleTest = useCallback(() => {
    const result = compileCustomCode(value || '')
    setTestResult(result)
  }, [value])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
    setTestResult(null)
  }, [onChange])

  return (
    <div className="space-y-3">
      <textarea
        value={value}
        onChange={handleChange}
        placeholder={CUSTOM_CODE_PLACEHOLDER}
        rows={18}
        disabled={disabled}
        spellCheck={false}
        className={`${panelMonoInputClass} min-h-0 resize-y whitespace-pre tab-size-2 leading-relaxed`}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleTest}
          disabled={disabled || !value?.trim()}
          className={settingsSecondaryButtonClass}
        >
          ▶ {t('skills.testCompile', 'Test Compile')}
        </button>

        {testResult && (
          <span className={`text-xs ${testResult.error ? 'text-danger' : 'text-green-400'}`}>
            {testResult.error
              ? <><IconifyIcon name="ui-cross" size={12} color="currentColor" /> {testResult.error}</>
              : <><IconifyIcon name="ui-check" size={12} color="currentColor" /> Compiled — {testResult.toolNames.length} tool(s) defined</>}
          </span>
        )}
      </div>

      {testResult && !testResult.error && testResult.toolNames.length > 0 && (
        <div className="rounded-xl border border-border p-3 space-y-1">
          <div className="text-[10px] text-text-muted uppercase tracking-wider font-medium mb-1">{t('skills.definedTools', 'Defined Tools')}</div>
          {testResult.toolNames.map((name) => (
            <div key={name} className="text-xs text-text-secondary font-mono flex items-center gap-2">
              <span className="text-accent"><IconifyIcon name="ui-wrench" size={12} color="currentColor" /></span> {name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Skill Dependencies Editor ────────────────────────────────────

export function SkillDependenciesEditor({ dependencies, onChange, disabled = false }: {
  dependencies: SkillDependency[]
  onChange: (deps: SkillDependency[]) => void
  disabled?: boolean
}) {
  const { skills } = useAppStore()
  const { t } = useI18n()
  const [adding, setAdding] = useState(false)
  const [newDepId, setNewDepId] = useState('')
  const [newMinVer, setNewMinVer] = useState('')

  const addDep = () => {
    if (!newDepId) return
    if (dependencies.some((d) => d.skillId === newDepId)) return
    onChange([...dependencies, { skillId: newDepId, minVersion: newMinVer || undefined, optional: false }])
    setNewDepId('')
    setNewMinVer('')
    setAdding(false)
  }

  const removeDep = (skillId: string) => onChange(dependencies.filter((d) => d.skillId !== skillId))
  const toggleOptional = (skillId: string) => onChange(dependencies.map((d) => d.skillId === skillId ? { ...d, optional: !d.optional } : d))

  const availableSkills = skills.filter((s) => !dependencies.some((d) => d.skillId === s.id))

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className={settingsLabelClass}>{t('skills.dependencies', 'Dependencies')}</label>
        {!disabled && (
          <button type="button" onClick={() => setAdding(!adding)} className="text-xs text-accent hover:text-accent-hover">
            {adding ? t('common.cancel', 'Cancel') : t('common.add', '+ Add')}
          </button>
        )}
      </div>
      {dependencies.length === 0 && !adding && (
        <p className="text-xs text-text-muted py-2">{t('skills.noDependencies', 'No dependencies declared.')}</p>
      )}
      {dependencies.length > 0 && (
        <div className="space-y-1 mb-2">
          {dependencies.map((dep) => {
            const depSkill = skills.find((s) => s.id === dep.skillId)
            return (
              <div key={dep.skillId} className="flex items-center justify-between p-2 rounded-lg bg-surface-2 border border-border-subtle text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary">{depSkill?.name || dep.skillId}</span>
                  {dep.minVersion && <span className="text-text-muted">≥{dep.minVersion}</span>}
                  {dep.optional && <span className="text-xs text-yellow-400">(optional)</span>}
                </div>
                {!disabled && (
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => toggleOptional(dep.skillId)} className="px-1.5 py-0.5 text-[10px] rounded bg-surface-3 text-text-muted hover:text-text-primary">
                      {dep.optional ? t('skills.required', 'Required') : t('skills.optional', 'Optional')}
                    </button>
                    <button type="button" onClick={() => removeDep(dep.skillId)} title="Remove dependency" className="px-1.5 py-0.5 text-[10px] text-red-400 hover:text-red-300"><IconifyIcon name="ui-close" size={12} color="currentColor" /></button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      {adding && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-surface-2 border border-border">
          <select
            value={newDepId}
            onChange={(e) => setNewDepId(e.target.value)}
            aria-label="Select dependency skill"
            className={`flex-1 ${panelCompactSelectClass}`}
          >
            <option value="">{t('skills.selectSkill', 'Select skill...')}</option>
            {availableSkills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input
            type="text"
            value={newMinVer}
            onChange={(e) => setNewMinVer(e.target.value)}
            placeholder="Min ver"
            className={`w-24 ${panelCompactInputClass}`}
          />
          <button type="button" onClick={addDep} className={panelCompactButtonClass}>Add</button>
        </div>
      )}
    </div>
  )
}

// ─── Skill Versions Panel ─────────────────────────────────────────

export function SkillVersionsPanel({ skill, updateForm }: { skill: Skill; updateForm: (patch: Partial<Skill>) => void }) {
  const { skillVersions, addSkillVersion, removeSkillVersions } = useAppStore()
  const versions = skillVersions.filter((v) => v.skillId === skill.id).sort((a, b) => b.createdAt - a.createdAt)
  const [label, setLabel] = useState('')
  const { t } = useI18n()

  const saveVersion = () => {
    const { id: _id, ...snapshot } = skill
    const ver: SkillVersion = {
      id: generateId('skver'),
      skillId: skill.id,
      version: skill.version || '1.0.0',
      snapshot,
      createdAt: Date.now(),
      label: label || undefined,
    }
    addSkillVersion(ver)
    setLabel('')
  }

  const restoreVersion = (ver: SkillVersion) => {
    const restored = { ...ver.snapshot }
    updateForm(restored)
  }

  return (
    <div className="space-y-4">
      {/* Create snapshot */}
      <div className="rounded-xl border border-border p-4 bg-surface-0/30">
        <h3 className="text-sm font-semibold text-text-primary mb-3">{t('skills.saveSnapshot', 'Save Version Snapshot')}</h3>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('skills.versionLabel', 'Version label (optional)')}
            className={`${settingsInputClass} flex-1`}
          />
          <button type="button" onClick={saveVersion} className={settingsPrimaryButtonClass}>
            {t('skills.saveSnapshotBtn', 'Save Snapshot')}
          </button>
        </div>
        <p className="text-xs text-text-muted mt-2">{t('skills.currentVersion', 'Current version:')} <span className="text-text-primary font-mono">{skill.version || '…'}</span></p>
      </div>

      {/* Version history */}
      <div className="rounded-xl border border-border p-4 bg-surface-0/30">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-text-primary">{t('skills.versionHistory', 'Version History')} ({versions.length})</h3>
          {versions.length > 0 && (
            <button
              type="button"
              onClick={async () => {
                const ok = await confirm({
                  title: t('skills.clearHistoryTitle', 'Clear version history?'),
                  body: t(
                    'skills.clearHistoryBody',
                    `All ${versions.length} saved version(s) of "${skill.name}" will be permanently removed. The current version is not affected.`,
                  ),
                  danger: true,
                  confirmText: t('common.clear', 'Clear'),
                })
                if (ok) removeSkillVersions(skill.id)
              }}
              className="text-xs text-red-400 hover:text-red-300"
            >
              {t('skills.clearAll', 'Clear All')}
            </button>
          )}
        </div>
        {versions.length === 0 ? (
          <p className="text-xs text-text-muted py-4 text-center">{t('skills.noVersions', 'No versions saved yet.')}</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {versions.map((ver) => (
              <div key={ver.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-2 border border-border-subtle">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-medium text-text-primary">v{ver.version}</span>
                    {ver.label && <span className="text-xs text-accent bg-accent/10 px-1.5 py-0.5 rounded">{ver.label}</span>}
                  </div>
                  <span className="text-[10px] text-text-muted">{new Date(ver.createdAt).toLocaleString()}</span>
                </div>
                <button
                  type="button"
                  onClick={() => restoreVersion(ver)}
                  className={panelCompactSecondaryButtonClass}
                >
                  {t('common.restore', 'Restore')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Changelog */}
      <div className="rounded-xl border border-border p-4 bg-surface-0/30">
        <h3 className="text-sm font-semibold text-text-primary mb-2">{t('skills.changelog', 'Changelog')}</h3>
        <textarea
          value={skill.changelog || ''}
          onChange={(e) => updateForm({ changelog: e.target.value })}
          placeholder={t('skills.changelogPlaceholder', 'Document changes between versions...')}
          rows={4}
          className={`${panelTextAreaClass} min-h-0 resize-none`}
        />
      </div>
    </div>
  )
}
