import { describe, expect, it } from 'vitest'
import { DEFAULT_UNSAVED_PIPELINE_VERSION, getDisplayPipelineVersion, getNextPipelineVersion, releasePipelineVersion } from './pipelineVersioning'

describe('pipelineVersioning', () => {
  it('shows an unsaved draft version before the first save', () => {
    expect(getDisplayPipelineVersion(null)).toBe(DEFAULT_UNSAVED_PIPELINE_VERSION)
  })

  it('starts saved workflows at 1.0 and increments the minor version on each save', () => {
    expect(getNextPipelineVersion(null)).toBe('1.0')
    expect(getNextPipelineVersion({ version: '1.0' })).toBe('1.1')
    expect(getNextPipelineVersion({ version: '1.7' })).toBe('1.8')
  })

  it('bumps the major version after a released workflow is edited again', () => {
    expect(getNextPipelineVersion({ version: '1.2', publishedVersion: '1.2' })).toBe('2.0')
    expect(getNextPipelineVersion({ version: '2.4', publishedVersion: '2.4' })).toBe('3.0')
    expect(releasePipelineVersion({ version: '2.4' })).toBe('2.4')
  })
})
