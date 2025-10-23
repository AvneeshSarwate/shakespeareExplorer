import type { Line } from './plays'

export type ExplainChatMessageRole = 'user' | 'assistant' | 'system'

export type ExplainChatMessage = {
  id: string
  role: ExplainChatMessageRole
  text: string
  timestamp: number
}

export type ExplainChatContextLine = Pick<Line, 'globalIndex' | 'sentence' | 'character' | 'text'>

export type ExplainChatSessionStatus = 'open' | 'collapsed'

export type ExplainChatSortMode = 'updated' | 'created' | 'play'

export type ExplainChatSessionVisibility = 'visible' | 'hidden'

export type ExplainChatSession = {
  id: string
  playId: string
  playName: string
  actNumber: number
  sceneNumber: number
  lineGlobalIndex: number
  lineSentence: number
  speaker: string
  lineText: string
  contextWindow: ExplainChatContextLine[]
  status: ExplainChatSessionStatus
  visibility: ExplainChatSessionVisibility
  messages: ExplainChatMessage[]
  followUpOptions: string[]
  pending: boolean
  error: string | null
  createdAt: number
  updatedAt: number
  hasHistory: boolean
  defaultUserText: string
}

export const DEFAULT_FOLLOW_UP_OPTIONS: string[] = [
  'Connect this to the scene',
  'What is the subtext?',
  'How might an actor deliver it?',
]

export function createChatIdentifier(args: {
  playId: string
  actNumber: number
  sceneNumber: number
  lineGlobalIndex: number
}) {
  const { playId, actNumber, sceneNumber, lineGlobalIndex } = args
  return `${playId}:${actNumber}:${sceneNumber}:${lineGlobalIndex}`
}

export function createMessageId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
