import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAppStore, initWorkspacePath, loadExternalSkillsAndAgents, loadSessionsFromWorkspace, loadSettingsFromWorkspace } from './appStore'
import type { Agent, Session, Skill } from '@/types'

// Mock sessionFiles and other file-based services
vi.mock('@/services/sessionFiles', () => ({
  loadSessionsFromDisk: vi.fn().mockResolvedValue([]),
  loadSessionFromDisk: vi.fn().mockResolvedValue(null),
  saveSessionToDisk: vi.fn().mockResolvedValue(undefined),
  deleteSessionFromDisk: vi.fn().mockResolvedValue(undefined),
  listSessionFiles: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/services/agentFiles', () => ({
  loadAgentsFromDisk: vi.fn().mockResolvedValue([]),
  saveAgentToDisk: vi.fn().mockResolvedValue(undefined),
  deleteAgentFromDisk: vi.fn().mockResolvedValue(undefined),
  listAgentFiles: vi.fn().mockResolvedValue([]),
  loadAgentFromDisk: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/services/workspaceSettings', () => ({
  loadWorkspaceSettings: vi.fn().mockResolvedValue(null),
  saveWorkspaceSettings: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/services/skillRegistry', () => ({
  loadAllSkills: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/services/externalDirectories', () => ({
  loadExternalResources: vi.fn().mockResolvedValue({ skills: [], agents: [] }),
  syncExternalDirectoryAccess: vi.fn().mockResolvedValue(undefined),
}))

import { loadAllSkills } from '@/services/skillRegistry'
import { loadExternalResources, syncExternalDirectoryAccess } from '@/services/externalDirectories'

describe('appStore', () => {
  beforeEach(() => {
    // Reset store to defaults
    useAppStore.setState({
      sessions: [],
      activeSessionId: null,
      agents: [],
      skills: [],
      notifications: [],
      installedPlugins: [],
      agentPipeline: [],
    })
  })

  describe('Session Management', () => {
    it('should add and retrieve sessions', () => {
      const { addSession } = useAppStore.getState()
      const session: Session = {
        id: 'test-session-1', title: 'Test', messages: [], createdAt: Date.now(), updatedAt: Date.now(),
      }
      addSession(session)
      const { sessions } = useAppStore.getState()
      expect(sessions.length).toBe(1)
      expect(sessions[0].id).toBe('test-session-1')
    })

    it('should remove session', () => {
      const { addSession } = useAppStore.getState()
      const session: Session = {
        id: 'test-session-2', title: 'Test', messages: [], createdAt: Date.now(), updatedAt: Date.now(),
      }
      addSession(session)
      useAppStore.getState().removeSession('test-session-2')
      expect(useAppStore.getState().sessions.length).toBe(0)
    })
  })

  describe('Agent Management', () => {
    it('should add agent', () => {
      const { addAgent } = useAppStore.getState()
      addAgent({
        id: 'agent-1', name: 'Test Agent', systemPrompt: 'You are a test agent',
        modelId: 'test:model', skills: [], enabled: true, memories: [], autoLearn: false,
      })
      expect(useAppStore.getState().agents.length).toBe(1)
      expect(useAppStore.getState().agents[0].name).toBe('Test Agent')
    })

    it('should clamp agent maxTurns to at least 2', () => {
      const { addAgent } = useAppStore.getState()
      addAgent({
        id: 'agent-max-turns', name: 'Turn Clamp', systemPrompt: 'You are a test agent',
        modelId: 'test:model', skills: [], enabled: true, memories: [], autoLearn: false, maxTurns: 1,
      })

      expect(useAppStore.getState().agents[0].maxTurns).toBe(2)
    })

    it('should update agent', () => {
      const { addAgent, updateAgent } = useAppStore.getState()
      addAgent({
        id: 'agent-2', name: 'Original', systemPrompt: 'Original prompt',
        modelId: 'test:model', skills: [], enabled: true, memories: [], autoLearn: false,
      })
      updateAgent('agent-2', { name: 'Updated' })
      expect(useAppStore.getState().agents[0].name).toBe('Updated')
    })

    it('should restore an agent from version history without losing memories', () => {
      const { addAgent, addAgentVersion, restoreAgentVersion } = useAppStore.getState()
      addAgent({
        id: 'agent-versioned', name: 'Current', systemPrompt: 'Current prompt',
        modelId: 'test:model', skills: [], enabled: true, memories: [{ id: 'mem-1', content: 'Remember me', type: 'preference', scope: 'global', createdAt: 1, source: 'test' }], autoLearn: false,
      })
      addAgentVersion({
        id: 'version-1',
        agentId: 'agent-versioned',
        version: 1,
        snapshot: {
          id: 'agent-versioned', name: 'Previous', systemPrompt: 'Previous prompt',
          modelId: 'test:model', skills: [], enabled: true, autoLearn: false,
        },
        createdAt: 1,
        source: 'manual',
      })

      restoreAgentVersion('version-1')

      const restored = useAppStore.getState().agents.find((item) => item.id === 'agent-versioned')
      expect(restored?.name).toBe('Previous')
      expect(restored?.memories).toHaveLength(1)
      const versions = useAppStore.getState().agentVersions
      expect(versions[versions.length - 1]?.source).toBe('rollback')
    })

    it('should keep selected agent in sync when updating agent settings', () => {
      const { addAgent, setSelectedAgent, updateAgent } = useAppStore.getState()
      addAgent({
        id: 'agent-selected', name: 'Original', systemPrompt: 'Original prompt',
        modelId: 'test:model', skills: [], enabled: true, memories: [], autoLearn: false, maxTurns: 5,
      })

      const addedAgent = useAppStore.getState().agents[0]
      setSelectedAgent(addedAgent)
      updateAgent('agent-selected', { name: 'Updated', maxTurns: 1 })

      expect(useAppStore.getState().selectedAgent?.name).toBe('Updated')
      expect(useAppStore.getState().selectedAgent?.maxTurns).toBe(2)
    })

    it('should remove agent', () => {
      const { addAgent, removeAgent } = useAppStore.getState()
      addAgent({
        id: 'agent-3', name: 'Temp', systemPrompt: '',
        modelId: 'test:model', skills: [], enabled: true, memories: [], autoLearn: false,
      })
      removeAgent('agent-3')
      expect(useAppStore.getState().agents.length).toBe(0)
    })

    it('should save and clear agent pipeline drafts', () => {
      const { setAgentPipeline, clearAgentPipeline } = useAppStore.getState()

      setAgentPipeline([
        { agentId: 'agent-1', task: 'First task' },
        { agentId: 'agent-2', task: 'Second task' },
      ])

      expect(useAppStore.getState().agentPipeline).toEqual([
        { agentId: 'agent-1', task: 'First task' },
        { agentId: 'agent-2', task: 'Second task' },
      ])

      clearAgentPipeline()

      expect(useAppStore.getState().agentPipeline).toEqual([])
    })
  })

  describe('Plugin Management', () => {
    it('should add installed plugin', () => {
      const { addInstalledPlugin } = useAppStore.getState()
      addInstalledPlugin({
        id: 'plugin-1', name: 'Test Plugin', version: '1.0.0', author: 'Test',
        description: 'Test', status: 'installed', hooks: ['afterResponse'],
        config: {}, installedAt: Date.now(),
      })
      expect(useAppStore.getState().installedPlugins.length).toBe(1)
    })

    it('should update plugin', () => {
      const { addInstalledPlugin, updateInstalledPlugin } = useAppStore.getState()
      addInstalledPlugin({
        id: 'plugin-2', name: 'Test', version: '1.0.0', author: 'Test',
        description: 'Test', status: 'installed', hooks: ['afterResponse'],
        config: {}, installedAt: Date.now(),
      })
      updateInstalledPlugin('plugin-2', { status: 'enabled' })
      expect(useAppStore.getState().installedPlugins[0].status).toBe('enabled')
    })

    it('should remove plugin', () => {
      const { addInstalledPlugin, removeInstalledPlugin } = useAppStore.getState()
      addInstalledPlugin({
        id: 'plugin-3', name: 'Temp', version: '1.0.0', author: 'Test',
        description: '', status: 'installed', hooks: ['afterResponse'],
        config: {}, installedAt: Date.now(),
      })
      removeInstalledPlugin('plugin-3')
      expect(useAppStore.getState().installedPlugins.length).toBe(0)
    })
  })

  describe('Notification Management', () => {
    it('should add notification', () => {
      const { addNotification } = useAppStore.getState()
      addNotification({ type: 'info', title: 'Test', message: 'Hello', id: 'n1', read: false, timestamp: Date.now() })
      const { notifications } = useAppStore.getState()
      expect(notifications.length).toBe(1)
      expect(notifications[0].title).toBe('Test')
      expect(notifications[0].read).toBe(false)
    })

    it('should mark notification as read', () => {
      const { addNotification, markNotificationRead } = useAppStore.getState()
      addNotification({ type: 'success', title: 'Success', id: 'n2', read: false, timestamp: Date.now() })
      const notif = useAppStore.getState().notifications[0]
      markNotificationRead(notif.id)
      expect(useAppStore.getState().notifications[0].read).toBe(true)
    })
  })

  describe('Model Usage Stats', () => {
    it('records latency and errors for model usage analytics', () => {
      const { recordModelUsage } = useAppStore.getState()

      recordModelUsage('provider:model', 10, 5, 100)
      recordModelUsage('provider:model', 20, 10, 200, true, 'rate limited')

      const stats = useAppStore.getState().modelUsageStats['provider:model']
      expect(stats.callCount).toBe(2)
      expect(stats.totalTokens).toBe(45)
      expect(stats.avgLatencyMs).toBe(150)
      expect(stats.errorCount).toBe(1)
      expect(stats.lastError).toBe('rate limited')
    })
  })

  describe('Navigation', () => {
    it('should set active module', () => {
      useAppStore.getState().setActiveModule('agents')
      expect(useAppStore.getState().activeModule).toBe('agents')
    })
  })

  describe('Startup Loading', () => {
    it('should prefer boot-config workspace path during initialization', async () => {
      vi.mocked(window.electron.invoke).mockImplementation(async (channel: string) => {
        if (channel === 'workspace:getBootConfig') {
          return { workspacePath: 'C:/boot-workspace' }
        }
        if (channel === 'workspace:init') {
          return { success: true }
        }
        if (channel === 'system:getDefaultWorkspacePath') {
          return 'C:/default-workspace'
        }
        return undefined
      })

      const workspacePath = await initWorkspacePath()

      expect(workspacePath).toBe('C:/boot-workspace')
      expect(useAppStore.getState().workspacePath).toBe('C:/boot-workspace')
      expect(window.electron.invoke).toHaveBeenCalledWith('workspace:getBootConfig')
      expect(window.electron.invoke).toHaveBeenCalledWith('workspace:init', 'C:/boot-workspace')
    })

    it('should load file-backed skills without importing file-backed agents during startup refresh', async () => {
      vi.mocked(loadAllSkills).mockResolvedValueOnce([
        {
          id: 'skill-local', name: 'Local Skill', description: 'Local description',
          type: 'custom', enabled: true, content: 'local', source: 'local', context: 'inline', frontmatter: { name: 'Local Skill', description: 'Local description' },
        },
      ] as never)
      vi.mocked(loadExternalResources).mockResolvedValueOnce({
        agents: [
          {
            id: 'agent-external', name: 'External Agent', systemPrompt: 'External prompt',
            modelId: 'test:model', skills: [], enabled: true, memories: [], autoLearn: false,
          },
        ],
        skills: [
          {
            id: 'skill-external', name: 'External Skill', description: 'External description',
            type: 'custom', enabled: true, content: 'external', source: 'workspace', context: 'inline', frontmatter: { name: 'External Skill', description: 'External description' },
          },
        ],
      })

      useAppStore.setState({
        workspacePath: 'C:/workspace',
        externalDirectories: [{ path: '~/.claude/skills', enabled: true, type: 'skills' }],
        agents: [{
          id: 'default-assistant', name: 'Assistant', systemPrompt: 'Default prompt',
          modelId: '', skills: [], enabled: true, memories: [], autoLearn: true,
        }],
        skills: [],
      })

      await loadExternalSkillsAndAgents()

      expect(syncExternalDirectoryAccess).toHaveBeenCalledWith(
        [{ path: '~/.claude/skills', enabled: true, type: 'skills' }],
        ['~/.suora/skills'],
      )
      expect(useAppStore.getState().agents.map((agent) => agent.id)).toEqual([
        'default-assistant',
      ])
      expect(useAppStore.getState().skills.map((skill) => skill.name)).toEqual([
        'Local Skill',
        'External Skill',
      ])
    })

    it('should preserve the latest selected agent while startup refresh is still loading', async () => {
      let resolveSkills!: (value: Awaited<ReturnType<typeof loadAllSkills>>) => void
      const pendingSkills = new Promise<Awaited<ReturnType<typeof loadAllSkills>>>((resolve) => {
        resolveSkills = resolve
      })

      const defaultAgent = {
        id: 'default-assistant', name: 'Assistant', systemPrompt: 'Default prompt',
        modelId: '', skills: [], enabled: true, memories: [], autoLearn: true,
      }
      const localAgent = {
        id: 'agent-local', name: 'Local Agent', systemPrompt: 'Local prompt',
        modelId: 'test:model', skills: [], enabled: true, memories: [], autoLearn: false,
      }

      vi.mocked(loadAllSkills).mockImplementationOnce(() => pendingSkills)
      vi.mocked(loadExternalResources).mockResolvedValueOnce({ skills: [], agents: [] })

      useAppStore.setState({
        workspacePath: 'C:/workspace',
        externalDirectories: [],
        agents: [defaultAgent, localAgent],
        selectedAgent: defaultAgent,
      })

      const refreshPromise = loadExternalSkillsAndAgents()

      useAppStore.getState().setSelectedAgent(localAgent)
      resolveSkills([] as never)
      await refreshPromise

      expect(useAppStore.getState().selectedAgent?.id).toBe('agent-local')
    })

    it('should keep hydrated store sessions without importing legacy disk sessions', async () => {
      const hydratedSession: Session = {
        id: 'session-hydrated',
        title: 'Hydrated session',
        createdAt: 1000,
        updatedAt: 3000,
        messages: [],
      }
      const newerHydratedSession: Session = {
        id: 'session-shared',
        title: 'Hydrated wins',
        createdAt: 1000,
        updatedAt: 5000,
        messages: [],
      }
      useAppStore.setState({
        workspacePath: 'C:/workspace',
        sessions: [hydratedSession, newerHydratedSession],
        openSessionTabs: ['session-hydrated', 'session-shared'],
        activeSessionId: 'session-shared',
      })

      await loadSessionsFromWorkspace()

      expect(useAppStore.getState().sessions.map((session) => session.id)).toEqual([
        'session-shared',
        'session-hydrated',
      ])
      expect(useAppStore.getState().sessions.find((session) => session.id === 'session-shared')?.title).toBe('Hydrated wins')
      expect(useAppStore.getState().activeSessionId).toBe('session-shared')
    })

    it('should keep hydrated custom agents and skills when workspace file scans return empty', async () => {
      const customAgent: Agent = {
        id: 'agent-hydrated', name: 'Hydrated Agent', systemPrompt: 'Stored prompt',
        modelId: 'test:model', skills: [], enabled: true, memories: [], autoLearn: false,
      }
      const customSkill: Skill = {
        id: 'skill-hydrated', name: 'Hydrated Skill', description: 'Stored skill',
        enabled: true, content: 'stored', source: 'local', context: 'inline', frontmatter: { name: 'Hydrated Skill', description: 'Stored skill' },
      }

      vi.mocked(loadAllSkills).mockResolvedValueOnce([] as never)
      vi.mocked(loadExternalResources).mockResolvedValueOnce({ skills: [], agents: [] })

      useAppStore.setState({
        workspacePath: 'C:/workspace',
        externalDirectories: [],
        agents: [{
          id: 'default-assistant', name: 'Assistant', systemPrompt: 'Default prompt',
          modelId: '', skills: [], enabled: true, memories: [], autoLearn: true,
        }, customAgent],
        skills: [customSkill],
      })

      await loadExternalSkillsAndAgents()

      expect(useAppStore.getState().agents.some((agent) => agent.id === customAgent.id)).toBe(true)
      expect(useAppStore.getState().skills.some((skill) => skill.id === customSkill.id)).toBe(true)
    })

    it('should not clear hydrated settings when workspace settings are empty', async () => {
      useAppStore.setState({
        workspacePath: 'C:/workspace',
        providerConfigs: [{
          id: 'provider-hydrated',
          name: 'Hydrated Provider',
          providerType: 'openai-compatible',
          apiKey: '',
          baseUrl: '',
          models: [],
        }],
        externalDirectories: [{ path: 'C:/skills', enabled: true, type: 'skills' }],
      })

      await loadSettingsFromWorkspace()

      expect(useAppStore.getState().providerConfigs.map((provider) => provider.id)).toEqual(['provider-hydrated'])
      expect(useAppStore.getState().externalDirectories.map((directory) => directory.path)).toEqual(['C:/skills'])
    })
  })
})
