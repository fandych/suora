// External directory loading for skills and agents
import type { Skill, Agent, ExternalDirectoryConfig, SkillSource } from '@/types'
import {
  attachBundledResources,
  parseSkillMarkdown,
  CLAUDE_CODE_SKILLS_DIRECTORY,
  OTHER_AGENTS_SKILLS_DIRECTORY,
} from '@/services/skillRegistry'
import { safeParse } from '@/utils/safeJson'

interface DirEntry {
  name: string
  isDirectory: boolean
  path: string
}

type ElectronBridge = { invoke: (ch: string, ...args: unknown[]) => Promise<unknown> }

function getElectron(): ElectronBridge | undefined {
  return (window as unknown as { electron?: ElectronBridge }).electron
}

function normalizeExternalDirectoryKey(path: string): string {
  return path.trim().replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

const LEGACY_EXTERNAL_DIRECTORY_ALIASES = new Map<string, string>([
  [normalizeExternalDirectoryKey('~/.claude/.suora/skills'), CLAUDE_CODE_SKILLS_DIRECTORY],
  [normalizeExternalDirectoryKey('~/.agents/.suora/skills'), OTHER_AGENTS_SKILLS_DIRECTORY],
])

export function normalizeExternalDirectoryPath(path: string): string {
  const normalizedPath = path.trim().replace(/\\/g, '/').replace(/\/+$/, '')
  if (!normalizedPath) return normalizedPath
  return LEGACY_EXTERNAL_DIRECTORY_ALIASES.get(normalizedPath.toLowerCase()) ?? normalizedPath
}

export function normalizeExternalDirectoryConfigs(
  directories: ExternalDirectoryConfig[],
): ExternalDirectoryConfig[] {
  const deduped = new Map<string, ExternalDirectoryConfig>()

  for (const directory of directories) {
    if (!directory?.path?.trim()) continue

    const normalizedPath = normalizeExternalDirectoryPath(directory.path)
    const key = `${directory.type}:${normalizeExternalDirectoryKey(normalizedPath)}`
    const existing = deduped.get(key)

    deduped.set(key, {
      ...(existing ?? directory),
      ...directory,
      path: normalizedPath,
      enabled: existing ? existing.enabled || directory.enabled : directory.enabled,
    })
  }

  return Array.from(deduped.values())
}

function getSkillSource(dirPath: string): SkillSource {
  const normalizedPath = normalizeExternalDirectoryPath(dirPath).toLowerCase()
  if (normalizedPath.includes('/.agents/')) return 'agent-dir'
  if (normalizedPath.includes('/.claude/')) return 'claude-dir'
  return 'workspace'
}

function isLegacySkillTools(value: unknown): boolean {
  return Array.isArray(value) && value.every((tool) => {
    if (!tool || typeof tool !== 'object' || Array.isArray(tool)) return false
    const candidate = tool as Record<string, unknown>
    return (
      typeof candidate.id === 'string'
      && typeof candidate.name === 'string'
      && typeof candidate.description === 'string'
      && Array.isArray(candidate.params)
    )
  })
}

function isElectronError(value: unknown): value is { error: string } {
  return !!value && typeof value === 'object' && 'error' in value
}

async function readSkillMarkdown(filePath: string, source: SkillSource): Promise<Skill | null> {
  const electron = getElectron()
  if (!electron) return null

  try {
    const content = await electron.invoke('fs:readFile', filePath) as string | { error: string }
    if (typeof content !== 'string') return null
    return parseSkillMarkdown(content, filePath, source)
  } catch {
    return null
  }
}

export async function syncExternalDirectoryAccess(
  directories: ExternalDirectoryConfig[],
  extraPaths: string[] = [],
): Promise<void> {
  const electron = getElectron()
  if (!electron) return

  const normalizedDirectories = normalizeExternalDirectoryConfigs(directories)

  const allowedPaths = [
    ...normalizedDirectories.filter((dir) => dir.enabled).map((dir) => dir.path),
    ...extraPaths.map(normalizeExternalDirectoryPath),
  ]
  const uniquePaths = Array.from(new Set(allowedPaths.filter((dirPath) => dirPath.trim().length > 0)))
  await electron.invoke('workspace:setExternalDirectories', uniquePaths)
}

/**
 * Load skills from an external directory
 */
export async function loadSkillsFromDirectory(dirPath: string): Promise<Skill[]> {
  const skills: Skill[] = []
  const source = getSkillSource(dirPath)
  const electron = getElectron()
  if (!electron) return skills

  try {
    const result = await electron.invoke('fs:listDir', dirPath) as DirEntry[] | { error: string }
    if (isElectronError(result)) {
      console.error(`Failed to read directory ${dirPath}:`, result.error)
      return skills
    }

    for (const entry of result) {
      if (entry.isDirectory) {
        const nestedSkill = await readSkillMarkdown(`${entry.path}/SKILL.md`, source)
          ?? await readSkillMarkdown(`${entry.path}/skill.md`, source)
        if (nestedSkill) {
          skills.push(await attachBundledResources(electron, nestedSkill, entry.path))
        }
        continue
      }

      if (entry.name.endsWith('.md')) {
        const skill = await readSkillMarkdown(entry.path, source)
        if (skill) skills.push(skill)
        continue
      }

      if (!entry.name.endsWith('.json')) continue

      try {
        const content = await electron.invoke('fs:readFile', entry.path) as string | { error: string }
        if (typeof content !== 'string') {
          console.warn(`Failed to read ${entry.name}:`, (content as { error: string }).error)
          continue
        }
        const skillData = safeParse<Partial<Skill>>(content)

        // Validate required fields
        if (typeof skillData.id !== 'string' || typeof skillData.name !== 'string' || !isLegacySkillTools(skillData.tools)) {
          console.warn(`Invalid skill file ${entry.name}: missing required fields`)
          continue
        }

        // Determine source based on directory path
        const skill: Skill = {
          id: skillData.id,
          name: skillData.name,
          description: skillData.description ?? '',
          enabled: skillData.enabled ?? true,
          source,
          content: skillData.content ?? skillData.prompt ?? '',
          frontmatter: skillData.frontmatter ?? {
            name: skillData.name,
            description: skillData.description ?? '',
          },
          allowedTools: skillData.allowedTools,
          whenToUse: skillData.whenToUse,
          context: skillData.context ?? 'inline',
          referenceFiles: skillData.referenceFiles,
          filePath: skillData.filePath,
          skillRoot: skillData.skillRoot,
          icon: skillData.icon,
          category: skillData.category,
          author: skillData.author,
          version: skillData.version,
          type: skillData.type ?? 'custom',
          prompt: skillData.prompt,
          tools: skillData.tools,
          customCode: skillData.customCode,
          config: skillData.config,
          dependencies: skillData.dependencies,
          changelog: skillData.changelog,
        }

        skills.push(skill)
      } catch (err) {
        console.warn(`Failed to load skill from ${entry.name}:`, err)
      }
    }
  } catch (err) {
    console.error(`Failed to read directory ${dirPath}:`, err)
  }

  return skills
}

/**
 * Load agents from an external directory
 */
export async function loadAgentsFromDirectory(dirPath: string): Promise<Agent[]> {
  const agents: Agent[] = []
  const electron = getElectron()
  if (!electron) return agents

  try {
    const result = await electron.invoke('fs:listDir', dirPath) as DirEntry[] | { error: string }
    if (isElectronError(result)) {
      console.error(`Failed to read directory ${dirPath}:`, result.error)
      return agents
    }

    for (const entry of result) {
      if (entry.isDirectory) continue
      if (!entry.name.endsWith('.json')) continue

      try {
        const content = await electron.invoke('fs:readFile', entry.path) as string | { error: string }
        if (typeof content !== 'string') {
          console.warn(`Failed to read ${entry.name}:`, (content as { error: string }).error)
          continue
        }
        const agentData = safeParse<Partial<Agent>>(content)

        // Validate required fields
        if (typeof agentData.id !== 'string' || typeof agentData.name !== 'string' || typeof agentData.systemPrompt !== 'string') {
          console.warn(`Invalid agent file ${entry.name}: missing required fields`)
          continue
        }

        const agent: Agent = {
          id: agentData.id,
          name: agentData.name,
          avatar: agentData.avatar || 'agent-robot',
          systemPrompt: agentData.systemPrompt,
          modelId: agentData.modelId || '',
          skills: agentData.skills || [],
          temperature: agentData.temperature ?? 0.7,
          maxTokens: agentData.maxTokens ?? 4096,
          enabled: agentData.enabled ?? true,
          greeting: agentData.greeting,
          responseStyle: agentData.responseStyle || 'balanced',
          allowedTools: agentData.allowedTools || [],
          memories: agentData.memories || [],
          autoLearn: agentData.autoLearn ?? true,
        }

        agents.push(agent)
      } catch (err) {
        console.warn(`Failed to load agent from ${entry.name}:`, err)
      }
    }
  } catch (err) {
    console.error(`Failed to read directory ${dirPath}:`, err)
  }

  return agents
}

/**
 * Load all external skills and agents based on external directory configs
 */
export async function loadExternalResources(
  directories: ExternalDirectoryConfig[]
): Promise<{ skills: Skill[]; agents: Agent[] }> {
  const skills: Skill[] = []
  const agents: Agent[] = []

  const normalizedDirectories = normalizeExternalDirectoryConfigs(directories)

  for (const dir of normalizedDirectories) {
    if (!dir.enabled) continue

    if (dir.type === 'skills') {
      const loadedSkills = await loadSkillsFromDirectory(dir.path)
      skills.push(...loadedSkills)
    } else if (dir.type === 'agents') {
      const loadedAgents = await loadAgentsFromDirectory(dir.path)
      agents.push(...loadedAgents)
    }
  }

  return { skills, agents }
}
