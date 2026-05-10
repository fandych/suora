import type { Session } from '@/types'

export function isMainChatSession(session: Pick<Session, 'surface'>): boolean {
  return (session.surface ?? 'chat') === 'chat'
}