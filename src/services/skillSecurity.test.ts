import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  computeSkillHash,
  signSkill,
  verifySkillSignature,
  auditCustomCode,
  getAuditLog,
  addAuditEntry,
  clearAuditLog,
  getAuditStats,
  type AuditLogEntry,
} from './skillSecurity'
import { writeCached } from './fileStorage'
import type { Skill } from '@/types'

// Mock crypto.subtle for testing
vi.stubGlobal('crypto', {
  subtle: {
    digest: async (_algorithm: string, data: Uint8Array) => {
      // Simple mock hash - just returns a consistent hash for testing
      const str = new TextDecoder().decode(data)
      const hash = str.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
      const buffer = new ArrayBuffer(32)
      const view = new Uint8Array(buffer)
      view[0] = hash % 256
      return buffer
    },
  },
})

describe('skillSecurity', () => {
  describe('computeSkillHash', () => {
    it('should compute consistent hash for same skill', async () => {
      const skill: Skill = {
        id: 'test-skill',
        name: 'Test Skill',
        description: 'Test description',
        source: 'local',
        content: '',
        frontmatter: { name: 'Test Skill', description: 'Test description' },
        context: 'inline',
        type: 'custom',
        enabled: true,
        tools: [],
        config: {},
      }

      const hash1 = await computeSkillHash(skill)
      const hash2 = await computeSkillHash(skill)

      expect(hash1).toBe(hash2)
      expect(hash1).toBeTruthy()
      expect(hash1).toMatch(/^[0-9a-f]+$/)
    })

    it('should compute different hash for different skills', async () => {
      const skill1: Skill = {
        id: 'skill-1',
        name: 'Skill 1',
        description: 'Description 1',
        source: 'local',
        content: '',
        frontmatter: { name: 'Skill 1', description: 'Description 1' },
        context: 'inline',
        type: 'custom',
        enabled: true,
        tools: [],
        config: {},
      }

      const skill2: Skill = {
        id: 'skill-2',
        name: 'Skill 2',
        description: 'Description 2',
        source: 'local',
        content: '',
        frontmatter: { name: 'Skill 2', description: 'Description 2' },
        context: 'inline',
        type: 'custom',
        enabled: true,
        tools: [],
        config: {},
      }

      const hash1 = await computeSkillHash(skill1)
      const hash2 = await computeSkillHash(skill2)

      expect(hash1).not.toBe(hash2)
    })

    it('should include customCode in hash computation', async () => {
      const skill: Skill = {
        id: 'test-skill',
        name: 'Test Skill',
        description: 'Test',
        source: 'local',
        content: '',
        frontmatter: { name: 'Test Skill', description: 'Test' },
        context: 'inline',
        type: 'custom',
        enabled: true,
        tools: [],
        config: {},
        customCode: 'console.log("test")',
      }

      const hash1 = await computeSkillHash(skill)

      skill.customCode = 'console.log("modified")'
      const hash2 = await computeSkillHash(skill)

      expect(hash1).not.toBe(hash2)
    })
  })

  describe('signSkill', () => {
    it('should create a valid signature', async () => {
      const skill: Skill = {
        id: 'test-skill',
        name: 'Test Skill',
        description: 'Test',
        source: 'local',
        content: '',
        frontmatter: { name: 'Test Skill', description: 'Test' },
        context: 'inline',
        type: 'custom',
        enabled: true,
        tools: [],
        config: {},
      }

      const signature = await signSkill(skill, 'test-user')

      expect(signature).toHaveProperty('hash')
      expect(signature).toHaveProperty('signedAt')
      expect(signature).toHaveProperty('signedBy', 'test-user')
      expect(signature).toHaveProperty('verified', true)
      expect(signature.signedAt).toBeGreaterThan(0)
    })

    it('should use default signedBy value', async () => {
      const skill: Skill = {
        id: 'test-skill',
        name: 'Test Skill',
        description: 'Test',
        source: 'local',
        content: '',
        frontmatter: { name: 'Test Skill', description: 'Test' },
        context: 'inline',
        type: 'custom',
        enabled: true,
        tools: [],
        config: {},
      }

      const signature = await signSkill(skill)

      expect(signature.signedBy).toBe('user')
    })
  })

  describe('verifySkillSignature', () => {
    it('should verify valid signature', async () => {
      const skill: Skill = {
        id: 'test-skill',
        name: 'Test Skill',
        description: 'Test',
        source: 'local',
        content: '',
        frontmatter: { name: 'Test Skill', description: 'Test' },
        context: 'inline',
        type: 'custom',
        enabled: true,
        tools: [],
        config: {},
      }

      const signature = await signSkill(skill)
      const isValid = await verifySkillSignature(skill, signature)

      expect(isValid).toBe(true)
    })

    it('should reject modified skill', async () => {
      const skill: Skill = {
        id: 'test-skill',
        name: 'Test Skill',
        description: 'Test',
        source: 'local',
        content: '',
        frontmatter: { name: 'Test Skill', description: 'Test' },
        context: 'inline',
        type: 'custom',
        enabled: true,
        tools: [],
        config: {},
      }

      const signature = await signSkill(skill)

      // Modify the skill
      skill.description = 'Modified description'

      const isValid = await verifySkillSignature(skill, signature)

      expect(isValid).toBe(false)
    })
  })

  describe('auditCustomCode', () => {
    it('should detect eval usage', () => {
      const code = 'const x = eval("1 + 1");'
      const findings = auditCustomCode(code)

      expect(findings).toHaveLength(1)
      expect(findings[0]).toMatchObject({
        severity: 'critical',
        message: expect.stringContaining('eval()'),
        line: 1,
      })
    })

    it('should detect Function constructor', () => {
      const code = 'const fn = new Function("return 42");'
      const findings = auditCustomCode(code)

      expect(findings).toHaveLength(1)
      expect(findings[0]).toMatchObject({
        severity: 'critical',
        message: expect.stringContaining('Function()'),
        line: 1,
      })
    })

    it('should detect require usage', () => {
      const code = 'const fs = require("fs");'
      const findings = auditCustomCode(code)

      expect(findings).toHaveLength(1)
      expect(findings[0]).toMatchObject({
        severity: 'critical',
        message: expect.stringContaining('require()'),
        line: 1,
      })
    })

    it('should detect dynamic import', () => {
      const code = 'const mod = await import("./module");'
      const findings = auditCustomCode(code)

      expect(findings).toHaveLength(1)
      expect(findings[0]).toMatchObject({
        severity: 'critical',
        message: expect.stringContaining('import()'),
        line: 1,
      })
    })

    it('should detect prototype pollution attempts', () => {
      const code = 'obj.__proto__.polluted = true;'
      const findings = auditCustomCode(code)

      expect(findings).toHaveLength(1)
      expect(findings[0]).toMatchObject({
        severity: 'critical',
        message: expect.stringContaining('Prototype pollution'),
        line: 1,
      })
    })

    it('should detect constructor.prototype', () => {
      const code = 'obj.constructor.prototype.polluted = true;'
      const findings = auditCustomCode(code)

      expect(findings).toHaveLength(1)
      expect(findings[0].severity).toBe('critical')
    })

    it('should detect infinite loops', () => {
      const code = 'while (true) { console.log("loop"); }'
      const findings = auditCustomCode(code)

      expect(findings).toHaveLength(1)
      expect(findings[0]).toMatchObject({
        severity: 'warning',
        message: expect.stringContaining('Infinite loop'),
        line: 1,
      })
    })

    it('should detect network access attempts', () => {
      const code = 'fetch("https://api.example.com");'
      const findings = auditCustomCode(code)

      expect(findings).toHaveLength(1)
      expect(findings[0]).toMatchObject({
        severity: 'warning',
        message: expect.stringContaining('Network access'),
        line: 1,
      })
    })

    it('should detect browser API usage', () => {
      const code = 'localStorage.setItem("key", "value");'
      const findings = auditCustomCode(code)

      expect(findings).toHaveLength(1)
      expect(findings[0]).toMatchObject({
        severity: 'warning',
        message: expect.stringContaining('Browser/global APIs'),
        line: 1,
      })
    })

    it('should detect process object reference', () => {
      const code = 'console.log(process.env);'
      const findings = auditCustomCode(code)

      expect(findings).toHaveLength(1)
      expect(findings[0]).toMatchObject({
        severity: 'warning',
        message: expect.stringContaining('process object'),
        line: 1,
      })
    })

    it('should detect multiple issues and sort by severity', () => {
      const code = `
        const x = 1; // safe
        fetch("https://api.example.com"); // warning
        eval("dangerous"); // critical
        window.alert("test"); // warning
      `
      const findings = auditCustomCode(code)

      expect(findings.length).toBeGreaterThan(0)
      // Critical should come first
      expect(findings[0].severity).toBe('critical')
      // Then warnings
      const criticalCount = findings.filter(f => f.severity === 'critical').length
      if (findings.length > criticalCount) {
        expect(findings[criticalCount].severity).toBe('warning')
      }
    })

    it('should return empty array for safe code', () => {
      const code = `
        function add(a, b) {
          return a + b;
        }
        const result = add(1, 2);
      `
      const findings = auditCustomCode(code)

      expect(findings).toHaveLength(0)
    })

    it('should report correct line numbers', () => {
      const code = `
line 1
line 2
eval("test")
line 4
`
      const findings = auditCustomCode(code)

      expect(findings).toHaveLength(1)
      expect(findings[0].line).toBe(4) // eval is on line 4
    })
  })

  describe('audit log', () => {
    beforeEach(() => {
      clearAuditLog()
    })

    it('should add and retrieve audit entries', () => {
      const entry: AuditLogEntry = {
        id: 'test-1',
        timestamp: Date.now(),
        toolName: 'test-tool',
        args: { param: 'value' },
        status: 'success',
      }

      addAuditEntry(entry)
      const log = getAuditLog()

      expect(log).toHaveLength(1)
      expect(log[0]).toMatchObject(entry)
    })

    it('should limit log size to MAX_AUDIT_LOG', () => {
      // Add more than MAX_AUDIT_LOG entries
      for (let i = 0; i < 1100; i++) {
        addAuditEntry({
          id: `test-${i}`,
          timestamp: Date.now(),
          toolName: 'test-tool',
          args: {},
          status: 'success',
        })
      }

      const log = getAuditLog()

      expect(log.length).toBeLessThanOrEqual(1000)
      // Should keep most recent entries
      expect(log[log.length - 1].id).toBe('test-1099')
    })

    it('should clear audit log', () => {
      addAuditEntry({
        id: 'test-1',
        timestamp: Date.now(),
        toolName: 'test-tool',
        args: {},
        status: 'success',
      })

      expect(getAuditLog()).toHaveLength(1)

      clearAuditLog()

      expect(getAuditLog()).toHaveLength(0)
    })

    it('should handle corrupted storage data gracefully', () => {
      writeCached('suora-audit-log', 'invalid-json{')

      const log = getAuditLog()

      expect(log).toEqual([])
    })
  })

  describe('getAuditStats', () => {
    beforeEach(() => {
      clearAuditLog()
    })

    it('should return zero stats for empty log', () => {
      const stats = getAuditStats()

      expect(stats).toMatchObject({
        total: 0,
        byTool: {},
        errors: 0,
        blocked: 0,
        last24h: 0,
      })
    })

    it('should count total entries', () => {
      addAuditEntry({
        id: 'test-1',
        timestamp: Date.now(),
        toolName: 'tool-a',
        args: {},
        status: 'success',
      })
      addAuditEntry({
        id: 'test-2',
        timestamp: Date.now(),
        toolName: 'tool-b',
        args: {},
        status: 'success',
      })

      const stats = getAuditStats()

      expect(stats.total).toBe(2)
    })

    it('should count by tool name', () => {
      addAuditEntry({
        id: 'test-1',
        timestamp: Date.now(),
        toolName: 'tool-a',
        args: {},
        status: 'success',
      })
      addAuditEntry({
        id: 'test-2',
        timestamp: Date.now(),
        toolName: 'tool-a',
        args: {},
        status: 'success',
      })
      addAuditEntry({
        id: 'test-3',
        timestamp: Date.now(),
        toolName: 'tool-b',
        args: {},
        status: 'success',
      })

      const stats = getAuditStats()

      expect(stats.byTool).toEqual({
        'tool-a': 2,
        'tool-b': 1,
      })
    })

    it('should count errors and blocked', () => {
      addAuditEntry({
        id: 'test-1',
        timestamp: Date.now(),
        toolName: 'tool-a',
        args: {},
        status: 'success',
      })
      addAuditEntry({
        id: 'test-2',
        timestamp: Date.now(),
        toolName: 'tool-b',
        args: {},
        status: 'error',
      })
      addAuditEntry({
        id: 'test-3',
        timestamp: Date.now(),
        toolName: 'tool-c',
        args: {},
        status: 'blocked',
      })
      addAuditEntry({
        id: 'test-4',
        timestamp: Date.now(),
        toolName: 'tool-d',
        args: {},
        status: 'error',
      })

      const stats = getAuditStats()

      expect(stats.errors).toBe(2)
      expect(stats.blocked).toBe(1)
    })

    it('should count last 24h entries', () => {
      const now = Date.now()
      const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000
      const yesterday = now - 12 * 60 * 60 * 1000

      addAuditEntry({
        id: 'old',
        timestamp: twoDaysAgo,
        toolName: 'tool-a',
        args: {},
        status: 'success',
      })
      addAuditEntry({
        id: 'recent-1',
        timestamp: yesterday,
        toolName: 'tool-b',
        args: {},
        status: 'success',
      })
      addAuditEntry({
        id: 'recent-2',
        timestamp: now,
        toolName: 'tool-c',
        args: {},
        status: 'success',
      })

      const stats = getAuditStats()

      expect(stats.total).toBe(3)
      expect(stats.last24h).toBe(2)
    })
  })
})
