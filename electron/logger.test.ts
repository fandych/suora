// @vitest-environment node

import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { closeLogger, initLogger } from './logger'

const tempDirectories: string[] = []

async function createTempDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'suora-logger-'))
  tempDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await closeLogger()
  await Promise.all(tempDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })))
})

describe('RotatingLogger', () => {
  it('lists and reads runtime log files', async () => {
    const logDir = await createTempDirectory()
    const logger = initLogger(logDir, 'debug')

    logger.info('hello logger', { ok: true })
    await logger.flush()

    const files = await logger.listFiles()
    expect(files).toHaveLength(1)
    expect(files[0]?.active).toBe(true)

    const content = await logger.readFile(files[0]?.name ?? '')
    expect(content).toContain('hello logger')
    expect(content).toContain('"ok":true')
  })

  it('guards log file reads by filename', async () => {
    const logDir = await createTempDirectory()
    const logger = initLogger(logDir, 'debug')

    await expect(logger.readFile('../outside.log')).rejects.toThrow('Invalid log file name')
  })

  it('serializes circular metadata without dropping the log entry', async () => {
    const logDir = await createTempDirectory()
    const logger = initLogger(logDir, 'debug')
    const circular: { self?: unknown } = {}
    circular.self = circular

    logger.warn('circular metadata', circular)
    await logger.flush()

    const files = await logger.listFiles()
    const content = await logger.readFile(files[0]?.name ?? '')
    expect(content).toContain('circular metadata')
    expect(content).toContain('[Circular]')
  })

  it('clears runtime log files and reopens an active file', async () => {
    const logDir = await createTempDirectory()
    const logger = initLogger(logDir, 'debug')

    logger.error('before clear')
    await logger.flush()
    expect(await logger.listFiles()).toHaveLength(1)

    await logger.clearFiles()

    expect(await logger.listFiles()).toHaveLength(0)

    logger.info('after clear')
    await logger.flush()

    const files = await logger.listFiles()
    expect(files).toHaveLength(1)
    expect(files[0]?.active).toBe(true)
    const content = await logger.readFile(files[0]?.name ?? '')
    expect(content).toContain('after clear')
    expect(content).not.toContain('before clear')
  })
})
