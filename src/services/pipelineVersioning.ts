import type { AgentPipeline } from '@/types'

export const DEFAULT_UNSAVED_PIPELINE_VERSION = '1.0.0'

function parseVersion(value: string | undefined): { major: number; minor: number } | null {
  if (!value?.trim()) return null
  const match = value.trim().match(/^(\d+)\.(\d+)(?:\.\d+)?$/)
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
  }
}

export function getDisplayPipelineVersion(pipeline: Pick<AgentPipeline, 'version'> | null | undefined): string {
  return pipeline?.version?.trim() || DEFAULT_UNSAVED_PIPELINE_VERSION
}

export function getNextPipelineVersion(pipeline: Pick<AgentPipeline, 'version' | 'publishedVersion'> | null | undefined): string {
  if (!pipeline?.version?.trim()) return '1.0'

  const current = parseVersion(pipeline.version)
  if (!current) return '1.0'

  if (pipeline.publishedVersion?.trim() && pipeline.publishedVersion.trim() === pipeline.version.trim()) {
    return `${current.major + 1}.0`
  }

  return `${current.major}.${current.minor + 1}`
}

export function releasePipelineVersion(pipeline: Pick<AgentPipeline, 'version'>): string {
  return pipeline.version?.trim() || '1.0'
}
