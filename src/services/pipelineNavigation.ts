export interface PipelineExecutionNavigationTarget {
  pipelineId: string
  executionId?: string
  timerId?: string
  firedAt?: number
}

export function buildPipelineExecutionPath({
  pipelineId,
  executionId,
  timerId,
  firedAt,
}: PipelineExecutionNavigationTarget): string {
  const query = new URLSearchParams({ pipelineId })
  if (timerId) query.set('timerId', timerId)
  if (Number.isFinite(firedAt)) query.set('firedAt', String(firedAt))
  if (executionId) query.set('executionId', executionId)
  return `/pipeline?${query.toString()}`
}
