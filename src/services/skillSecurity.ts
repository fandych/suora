// Skill Signing & Security Audit
//
// Provides SHA-256 integrity hashing for skills, audit logging of tool
// execution, and basic code analysis for custom skill code.

import type { Skill, SkillSignature } from '@/types'
import { readCached, writeCached, removeCached } from '@/services/fileStorage'
import { safeParse, safeStringify } from '@/utils/safeJson'

// ─── SHA-256 hashing ────────────────────────────────────────────────

/**
 * Compute a SHA-256 hash of the skill's significant content.
 * Uses the Web Crypto API available in Electron's renderer process.
 */
export async function computeSkillHash(skill: Skill): Promise<string> {
  // Deterministic serialization of the fields that matter for integrity
  const payload = JSON.stringify({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    tools: skill.tools,
    customCode: skill.customCode || '',
    prompt: skill.prompt || '',
  })

  const encoder = new TextEncoder()
  const data = encoder.encode(payload)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Sign a skill: compute its hash and return a SkillSignature.
 */
export async function signSkill(skill: Skill, signedBy = 'user'): Promise<SkillSignature> {
  const hash = await computeSkillHash(skill)
  return {
    hash,
    signedAt: Date.now(),
    signedBy,
    verified: true,
  }
}

/**
 * Verify a skill's signature against its current content.
 */
export async function verifySkillSignature(
  skill: Skill,
  signature: SkillSignature,
): Promise<boolean> {
  const currentHash = await computeSkillHash(skill)
  return constantTimeEqual(currentHash, signature.hash)
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Works in the renderer process without Node crypto.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

// ─── Security audit for custom code ─────────────────────────────────

export interface SecurityFinding {
  severity: 'info' | 'warning' | 'critical'
  message: string
  line?: number
}

/**
 * Analyze custom skill code for potential security issues.
 * Returns a list of findings sorted by severity.
 */
export function auditCustomCode(code: string): SecurityFinding[] {
  const findings: SecurityFinding[] = []
  const lines = code.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    // Check for dangerous patterns
    if (/\beval\s*\(/.test(line)) {
      findings.push({ severity: 'critical', message: 'Use of eval() is dangerous and blocked', line: lineNum })
    }
    if (/\bFunction\s*\(/.test(line)) {
      findings.push({ severity: 'critical', message: 'Dynamic Function() constructor is dangerous', line: lineNum })
    }

    // Check for Function constructor bypass attempts
    if (/\(\s*class\s*\{\s*\}\s*\)\s*\.\s*constructor/.test(line)) {
      findings.push({ severity: 'critical', message: 'Attempt to access Function constructor via class', line: lineNum })
    }
    if (/Object\.getPrototypeOf\s*\(\s*(async\s+)?function/.test(line)) {
      findings.push({ severity: 'critical', message: 'Attempt to access Function constructor via prototype chain', line: lineNum })
    }
    if (/\.\s*constructor\s*\.\s*constructor/.test(line)) {
      findings.push({ severity: 'critical', message: 'Attempt to access Function constructor via constructor chain', line: lineNum })
    }

    if (/\brequire\s*\(/.test(line)) {
      findings.push({ severity: 'critical', message: 'require() is not available in sandboxed context', line: lineNum })
    }
    if (/\bimport\s*\(/.test(line)) {
      findings.push({ severity: 'critical', message: 'Dynamic import() is not available in sandboxed context', line: lineNum })
    }
    if (/\bprocess\b/.test(line)) {
      findings.push({ severity: 'warning', message: 'Reference to process object (blocked in sandbox)', line: lineNum })
    }

    // Check for blocked reflection APIs
    if (/\bReflect\s*\./.test(line)) {
      findings.push({ severity: 'critical', message: 'Reflect API is blocked (can bypass sandbox)', line: lineNum })
    }
    if (/\bProxy\s*\(/.test(line)) {
      findings.push({ severity: 'warning', message: 'Proxy is blocked in sandbox', line: lineNum })
    }
    if (/Symbol\s*\.\s*for\s*\(/.test(line)) {
      findings.push({ severity: 'warning', message: 'Symbol.for() can access global registry (blocked)', line: lineNum })
    }

    // Check for timer functions (can be used for DoS)
    if (/\b(setTimeout|setInterval|setImmediate)\s*\(/.test(line)) {
      findings.push({ severity: 'warning', message: 'Timer functions are blocked in sandbox', line: lineNum })
    }

    if (/\b(fetch|XMLHttpRequest|WebSocket)\b/.test(line)) {
      findings.push({ severity: 'warning', message: 'Network access is blocked in sandboxed context', line: lineNum })
    }
    if (/\b(localStorage|sessionStorage|document|window|globalThis)\b/.test(line)) {
      findings.push({ severity: 'warning', message: 'Browser/global APIs are blocked in sandboxed context', line: lineNum })
    }
    if (/\bwhile\s*\(\s*true\s*\)/.test(line)) {
      findings.push({ severity: 'warning', message: 'Infinite loop detected', line: lineNum })
    }
    if (/\b(__proto__|constructor\.prototype)\b/.test(line)) {
      findings.push({ severity: 'critical', message: 'Prototype pollution attempt detected', line: lineNum })
    }
  }

  // Sort: critical first, then warning, then info
  const order = { critical: 0, warning: 1, info: 2 }
  findings.sort((a, b) => order[a.severity] - order[b.severity])

  return findings
}

// ─── Tool execution audit log ───────────────────────────────────────

export interface AuditLogEntry {
  id: string
  timestamp: number
  toolName: string
  args: Record<string, unknown>
  agentId?: string
  sessionId?: string
  result?: string
  duration?: number
  status: 'success' | 'error' | 'blocked'
}

const MAX_AUDIT_LOG = 1000
const AUDIT_STORAGE_KEY = 'suora-audit-log'
let auditLogCache: AuditLogEntry[] | null = null

export function getAuditLog(): AuditLogEntry[] {
  if (auditLogCache) return [...auditLogCache]
  try {
    const raw = readCached(AUDIT_STORAGE_KEY)
    auditLogCache = raw ? safeParse<AuditLogEntry[]>(raw) : []
    return [...auditLogCache]
  } catch {
    auditLogCache = []
    return []
  }
}

export function addAuditEntry(entry: AuditLogEntry): void {
  const log = auditLogCache ?? getAuditLog()
  log.push(entry)
  // Keep only the most recent entries
  auditLogCache = log.length > MAX_AUDIT_LOG ? log.slice(-MAX_AUDIT_LOG) : log
  writeCached(AUDIT_STORAGE_KEY, safeStringify(auditLogCache))
}

export function clearAuditLog(): void {
  auditLogCache = null
  removeCached(AUDIT_STORAGE_KEY)
}

/**
 * Get audit statistics.
 */
export function getAuditStats(): {
  total: number
  byTool: Record<string, number>
  errors: number
  blocked: number
  last24h: number
} {
  const log = getAuditLog()
  const now = Date.now()
  const oneDayAgo = now - 24 * 60 * 60 * 1000

  const byTool: Record<string, number> = {}
  let errors = 0
  let blocked = 0
  let last24h = 0

  for (const entry of log) {
    byTool[entry.toolName] = (byTool[entry.toolName] || 0) + 1
    if (entry.status === 'error') errors++
    if (entry.status === 'blocked') blocked++
    if (entry.timestamp >= oneDayAgo) last24h++
  }

  return { total: log.length, byTool, errors, blocked, last24h }
}
