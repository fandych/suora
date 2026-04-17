import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAppStore, initWorkspacePath, loadExternalSkillsAndAgents } from './appStore'
import type { Session } from '@/types'

// Mock sessionFiles and other file-based services
vi.mock('@/services/sessionFiles', () => ({
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

import { loadAgentsFromDisk } from '@/services/agentFiles'
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

    it('should load persisted agents and skills during startup refresh', async () => {
      vi.mocked(loadAgentsFromDisk).mockResolvedValueOnce([
        {
          id: 'agent-local', name: 'Local Agent', systemPrompt: 'Local prompt',
          modelId: 'test:model', skills: [], enabled: true, memories: [], autoLearn: false,
        },
      ])
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
        'agent-local',
        'agent-external',
      ])
      expect(useAppStore.getState().skills.map((skill) => skill.name)).toEqual([
        'Local Skill',
        'External Skill',
      ])
    })
  })
})
