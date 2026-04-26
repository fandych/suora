/**
 * Skill Marketplace — integrates with skills.sh and custom registries.
 *
 * Supports:
 * - skills.sh leaderboard browsing
 * - GitHub repository skill discovery
 * - Custom registry sources
 * - Skill installation (download SKILL.md from repos)
 * - Update checking
 *
 * Skills are installed by downloading SKILL.md files from GitHub repositories
 * into the local skills directory. No npm/package installation needed.
 */

import type { SkillRegistrySource, RegistrySkillEntry, Skill } from '@/types'
import { t } from '@/services/i18n'
import { parseSkillMarkdown } from '@/services/skillRegistry'
import { logger } from '@/services/logger'

type ElectronBridge = { invoke: (ch: string, ...args: unknown[]) => Promise<unknown> }

function getElectron(): ElectronBridge | undefined {
  return (window as unknown as { electron?: ElectronBridge }).electron
}

// ─── Default Registry Sources ──────────────────────────────────────

export function getDefaultRegistrySources(): SkillRegistrySource[] {
  return [
    {
      id: 'skills-sh',
      name: 'skills.sh',
      type: 'skills.sh',
      url: 'https://skills.sh',
      enabled: true,
      builtin: true,
      description: t('skills.registrySource.skillsSh', 'The open agent skills ecosystem by Vercel'),
      icon: 'lucide:globe',
    },
    {
      id: 'vercel-agent-skills',
      name: 'Vercel Agent Skills',
      type: 'github',
      url: 'https://github.com/vercel-labs/agent-skills',
      enabled: true,
      builtin: true,
      description: t('skills.registrySource.vercel', 'Official Vercel agent skills collection'),
      icon: 'lucide:triangle',
    },
    {
      id: 'anthropics-skills',
      name: 'Anthropic Skills',
      type: 'github',
      url: 'https://github.com/anthropics/skills',
      enabled: true,
      builtin: true,
      description: t('skills.registrySource.anthropic', 'Official Anthropic agent skills'),
      icon: 'lucide:brain',
    },
  ]
}

// ─── Skills.sh Leaderboard Fetching ────────────────────────────────

/**
 * Featured / popular skills from skills.sh.
 * Since skills.sh doesn't have a public JSON API, we fetch
 * known popular skill repos and their skill listings.
 */
function getFeaturedSkills(): RegistrySkillEntry[] {
  return [
    {
      id: 'skills-sh/vercel-labs/agent-skills/frontend-design',
      name: 'frontend-design',
      description: t('skills.featured.frontendDesign', 'Create distinctive, production-grade frontend interfaces with high design quality'),
      author: 'vercel-labs',
      version: '1.0.0',
      repository: 'vercel-labs/agent-skills',
      sourceId: 'skills-sh',
      downloads: 222200,
      rating: 4.9,
      icon: 'lucide:palette',
      category: t('skills.featuredCategory.frontend', 'Frontend'),
      installed: false,
      url: 'https://skills.sh/anthropics/skills/frontend-design',
    },
    {
      id: 'skills-sh/vercel-labs/agent-skills/vercel-react-best-practices',
      name: 'vercel-react-best-practices',
      description: t('skills.featured.vercelReactBestPractices', 'React and Next.js performance optimization guidelines from Vercel Engineering'),
      author: 'vercel-labs',
      version: '1.0.0',
      repository: 'vercel-labs/agent-skills',
      sourceId: 'skills-sh',
      downloads: 263700,
      rating: 4.9,
      icon: 'lucide:zap',
      category: t('skills.featuredCategory.frontend', 'Frontend'),
      installed: false,
      url: 'https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices',
    },
    {
      id: 'skills-sh/vercel-labs/agent-skills/web-design-guidelines',
      name: 'web-design-guidelines',
      description: t('skills.featured.webDesignGuidelines', 'Review UI code for Web Interface Guidelines compliance'),
      author: 'vercel-labs',
      version: '1.0.0',
      repository: 'vercel-labs/agent-skills',
      sourceId: 'skills-sh',
      downloads: 212900,
      rating: 4.8,
      icon: 'lucide:monitor',
      category: t('skills.featuredCategory.design', 'Design'),
      installed: false,
      url: 'https://skills.sh/vercel-labs/agent-skills/web-design-guidelines',
    },
    {
      id: 'skills-sh/anthropics/skills/skill-creator',
      name: 'skill-creator',
      description: t('skills.builtin.skillCreator.description', 'Create new skills, modify and improve existing skills, and measure skill performance'),
      author: 'anthropics',
      version: '1.0.0',
      repository: 'anthropics/skills',
      sourceId: 'skills-sh',
      downloads: 117800,
      rating: 4.7,
      icon: 'lucide:wrench',
      category: t('skills.featuredCategory.development', 'Development'),
      installed: false,
      url: 'https://skills.sh/anthropics/skills/skill-creator',
    },
    {
      id: 'skills-sh/vercel-labs/agent-browser/agent-browser',
      name: 'agent-browser',
      description: t('skills.featured.agentBrowser', 'Browser automation CLI for AI agents — navigate, fill forms, take screenshots'),
      author: 'vercel-labs',
      version: '1.0.0',
      repository: 'vercel-labs/agent-browser',
      sourceId: 'skills-sh',
      downloads: 142800,
      rating: 4.8,
      icon: 'lucide:globe',
      category: t('skills.featuredCategory.automation', 'Automation'),
      installed: false,
      url: 'https://skills.sh/vercel-labs/agent-browser/agent-browser',
    },
    {
      id: 'skills-sh/vercel-labs/skills/find-skills',
      name: 'find-skills',
      description: t('skills.builtin.findSkills.description', 'Helps discover and install agent skills from the skills.sh ecosystem'),
      author: 'vercel-labs',
      version: '1.0.0',
      repository: 'vercel-labs/skills',
      sourceId: 'skills-sh',
      downloads: 787500,
      rating: 4.9,
      icon: 'lucide:search',
      category: t('skills.featuredCategory.utility', 'Utility'),
      installed: false,
      url: 'https://skills.sh/vercel-labs/skills/find-skills',
    },
    {
      id: 'skills-sh/anthropics/skills/ai-sdk',
      name: 'ai-sdk',
      description: t('skills.featured.aiSdk', 'Build AI-powered features using the Vercel AI SDK'),
      author: 'anthropics',
      version: '1.0.0',
      repository: 'anthropics/skills',
      sourceId: 'skills-sh',
      downloads: 165000,
      rating: 4.8,
      icon: 'lucide:cpu',
      category: t('skills.featuredCategory.ai', 'AI'),
      installed: false,
      url: 'https://skills.sh/anthropics/skills/ai-sdk',
    },
    {
      id: 'skills-sh/remotion-dev/skills/remotion-best-practices',
      name: 'remotion-best-practices',
      description: t('skills.featured.remotionBestPractices', 'Best practices for building Remotion video applications'),
      author: 'remotion-dev',
      version: '1.0.0',
      repository: 'remotion-dev/skills',
      sourceId: 'skills-sh',
      downloads: 189800,
      rating: 4.7,
      icon: 'lucide:video',
      category: t('skills.featuredCategory.media', 'Media'),
      installed: false,
      url: 'https://skills.sh/remotion-dev/skills/remotion-best-practices',
    },
  ]
}

// ─── GitHub Repository Skill Discovery ─────────────────────────────

/**
 * Discover skills from a GitHub repository.
 * Looks for SKILL.md files in standard locations:
 *   - skills/<name>/SKILL.md
 *   - .agents/skills/<name>/SKILL.md
 *   - .claude/skills/<name>/SKILL.md
 */
export async function discoverSkillsFromGitHub(
  repoUrl: string,
  sourceId: string,
): Promise<RegistrySkillEntry[]> {
  const electron = getElectron()
  if (!electron) return []

  // Parse GitHub URL to owner/repo format
  const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/)
  if (!match) {
    logger.warn(`[marketplace] Invalid GitHub URL: ${repoUrl}`)
    return []
  }
  const owner = match[1]
  const repo = match[2]

  // Use GitHub API to list skills directory contents
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/skills`
  try {
    const fetchResult = (await electron.invoke('web:fetch', apiUrl)) as { content?: string; error?: string }
    if (fetchResult.error || typeof fetchResult.content !== 'string') {
      logger.warn(`[marketplace] GitHub API fetch failed for ${apiUrl}: ${fetchResult.error ?? 'empty response'}`)
      return []
    }
    const result = JSON.parse(fetchResult.content) as
      | { name: string; type: string; path: string; html_url?: string }[]
      | { message?: string; error?: string }

    if (!Array.isArray(result)) {
      logger.warn(`[marketplace] GitHub API returned non-array for ${apiUrl}`)
      return []
    }

    const entries: RegistrySkillEntry[] = []
    for (const item of result) {
      if (item.type !== 'dir') continue

      // Try to fetch the SKILL.md file to get metadata
      const skillMdUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/skills/${item.name}/SKILL.md`
      try {
        const content = (await electron.invoke('web:fetch', skillMdUrl)) as { content?: string; error?: string }
        if (content.error || !content.content) continue

        const skill = parseSkillMarkdown(content.content, `${item.name}/SKILL.md`, 'registry')
        if (!skill) continue

        entries.push({
          id: `${sourceId}/${owner}/${repo}/${item.name}`,
          name: skill.name,
          description: skill.description,
          author: owner,
          version: skill.version || '1.0.0',
          repository: `${owner}/${repo}`,
          sourceId,
          downloads: 0,
          rating: 0,
          icon: skill.icon,
          category: skill.category,
          installed: false,
          url: `https://github.com/${owner}/${repo}/tree/main/skills/${item.name}`,
          preview: skill.content.slice(0, 200),
        })
      } catch {
        // Skip skills that fail to fetch
      }
    }

    return entries
  } catch (err) {
    logger.warn(`[marketplace] Failed to discover skills from ${repoUrl}`, {
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

// ─── Skill Installation ────────────────────────────────────────────

/**
 * Install a skill from a registry by downloading its SKILL.md file.
 */
export async function installSkillFromRegistry(
  entry: RegistrySkillEntry,
  targetDir: string,
): Promise<Skill | null> {
  const electron = getElectron()
  if (!electron) return null

  try {
    // Determine the raw content URL
    const contentUrl = getSkillContentUrl(entry)
    if (!contentUrl) {
      logger.error(`[marketplace] Cannot determine content URL for skill: ${entry.name}`)
      return null
    }

    // Fetch the SKILL.md content
    const result = (await electron.invoke('web:fetch', contentUrl)) as {
      content?: string
      error?: string
    }

    if (result.error || !result.content) {
      logger.error(`[marketplace] Failed to fetch skill content: ${result.error}`)
      return null
    }

    // Parse to validate it's a valid skill
    const skill = parseSkillMarkdown(result.content, `${entry.name}/SKILL.md`, 'registry')
    if (!skill) {
      logger.error(`[marketplace] Invalid SKILL.md format for: ${entry.name}`)
      return null
    }

    // Save to disk
    const skillDir = `${targetDir}/${entry.name}`
    await electron.invoke('system:ensureDirectory', skillDir)
    const writeResult = (await electron.invoke(
      'fs:writeFile',
      `${skillDir}/SKILL.md`,
      result.content,
    )) as { success?: boolean }

    if (!writeResult?.success) {
      logger.error(`[marketplace] Failed to write SKILL.md for: ${entry.name}`)
      return null
    }

    // Add install info
    skill.installInfo = {
      sourceId: entry.sourceId,
      repository: entry.repository,
      skillName: entry.name,
      installedVersion: entry.version,
      installedAt: Date.now(),
    }
    skill.filePath = `${skillDir}/SKILL.md`
    skill.skillRoot = skillDir
    skill.downloads = entry.downloads
    skill.rating = entry.rating

    logger.info(`[marketplace] Installed skill: ${entry.name} from ${entry.repository}`)
    return skill
  } catch (err) {
    logger.error(`[marketplace] Install failed for ${entry.name}`, {
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

/**
 * Uninstall a skill by removing its files from disk.
 */
export async function uninstallSkill(skill: Skill): Promise<boolean> {
  const electron = getElectron()
  if (!electron) return false

  if (!skill.skillRoot && !skill.filePath) return false

  try {
    if (skill.skillRoot) {
      const result = (await electron.invoke('fs:deleteDir', skill.skillRoot)) as { success?: boolean }
      return result?.success ?? false
    }

    const filePath = skill.filePath
    if (!filePath) return false
    const result = (await electron.invoke('fs:deleteFile', filePath)) as { success?: boolean }
    return result?.success ?? false
  } catch {
    return false
  }
}

/**
 * Check if updates are available for installed registry skills.
 */
export async function checkSkillUpdates(
  installedSkills: Skill[],
): Promise<Map<string, string>> {
  const electron = getElectron()
  if (!electron) return new Map()

  const updates = new Map<string, string>()

  for (const skill of installedSkills) {
    if (!skill.installInfo) continue

    try {
      const contentUrl = getSkillContentUrlFromInstallInfo(skill.installInfo)
      if (!contentUrl) continue

      const result = (await electron.invoke('web:fetch', contentUrl)) as {
        content?: string
        error?: string
      }

      if (result.error || !result.content) continue

      const remote = parseSkillMarkdown(result.content, 'remote', 'registry')
      if (!remote) continue

      if (remote.version && remote.version !== skill.installInfo.installedVersion) {
        updates.set(skill.id, remote.version)
      }
    } catch {
      // Skip
    }
  }

  return updates
}

// ─── Browsing ──────────────────────────────────────────────────────

/**
 * Get the list of skills from all enabled registry sources.
 * Merges featured skills with discovered GitHub skills.
 */
export async function browseRegistrySkills(
  sources: SkillRegistrySource[],
  installedSkillNames: Set<string>,
): Promise<RegistrySkillEntry[]> {
  const allEntries: RegistrySkillEntry[] = []

  // Start with featured skills from skills.sh
  const featured = getFeaturedSkills().map((s) => ({
    ...s,
    installed: installedSkillNames.has(s.name),
  }))
  allEntries.push(...featured)

  // Discover skills from each enabled GitHub source
  for (const source of sources.filter((s) => s.enabled && s.type === 'github')) {
    try {
      const discovered = await discoverSkillsFromGitHub(source.url, source.id)
      for (const entry of discovered) {
        // Don't add duplicates
        if (!allEntries.some((e) => e.name === entry.name && e.repository === entry.repository)) {
          entry.installed = installedSkillNames.has(entry.name)
          allEntries.push(entry)
        }
      }
    } catch {
      // Skip failed sources
    }
  }

  return allEntries
}

/**
 * Search registry skills by query.
 */
export function searchRegistrySkills(
  skills: RegistrySkillEntry[],
  query: string,
): RegistrySkillEntry[] {
  const q = query.toLowerCase().trim()
  if (!q) return skills

  return skills.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.author.toLowerCase().includes(q) ||
      (s.category?.toLowerCase().includes(q) ?? false),
  )
}

// ─── Helpers ───────────────────────────────────────────────────────

function getSkillContentUrl(entry: RegistrySkillEntry): string | null {
  // GitHub raw content URL
  const match = entry.repository.match(/^([^/]+)\/([^/]+)$/)
  if (!match) return null

  const [, owner, repo] = match
  return `https://raw.githubusercontent.com/${owner}/${repo}/main/skills/${entry.name}/SKILL.md`
}

function getSkillContentUrlFromInstallInfo(
  info: { repository: string; skillName: string },
): string | null {
  const match = info.repository.match(/^([^/]+)\/([^/]+)$/)
  if (!match) return null

  const [, owner, repo] = match
  return `https://raw.githubusercontent.com/${owner}/${repo}/main/skills/${info.skillName}/SKILL.md`
}
