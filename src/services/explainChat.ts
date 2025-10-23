import Anthropic from '@anthropic-ai/sdk'
import type {
  ExplainChatContextLine,
  ExplainChatConversationMessage,
} from '../types/explain'

export type ExplainChatRequestPayload = {
  apiKey: string
  playName: string
  actNumber: number
  sceneNumber: number
  lineSentence: number
  speaker: string
  lineText: string
  contextWindow: ExplainChatContextLine[]
  messages: ExplainChatConversationMessage[]
  followUpOptions: string[]
}

export type ExplainChatResponsePayload = {
  assistantText: string
  followUpOptions: string[]
}

const MODEL_NAME = 'claude-3-5-sonnet-20241022'
const MAX_TOKENS = 800

const SYSTEM_PREAMBLE = `You are a thoughtful Shakespeare tutor. Offer clear, grounded explanations that connect language, rhetoric, and dramatic stakes. Focus on the play text provided and avoid spoilers beyond the surrounding context unless asked.`

function renderContextSnippet(contextWindow: ExplainChatContextLine[]) {
  return contextWindow
    .map(line => {
      const speaker = line.character ? ` (${line.character})` : ''
      return `Line ${line.sentence}${speaker}: ${line.text}`
    })
    .join('\n')
}

export function buildSystemPrompt(payload: ExplainChatRequestPayload) {
  const context = renderContextSnippet(payload.contextWindow)
  return `${SYSTEM_PREAMBLE}

Play: ${payload.playName}
Act: ${payload.actNumber}
Scene: ${payload.sceneNumber}
Speaker: ${payload.speaker}
Line number: ${payload.lineSentence}
Line text: ${payload.lineText}

Context window:
${context}`
}

function toAnthropicMessages(messages: ExplainChatConversationMessage[]) {
  return messages
    .filter(message => message.role !== 'system')
    .map(message => ({
      role: message.role as 'user' | 'assistant',
      content: [{ type: 'text' as const, text: message.text }],
    }))
}

export async function requestLineExplanation(
  payload: ExplainChatRequestPayload,
): Promise<ExplainChatResponsePayload> {
  const apiKey = payload.apiKey.trim()
  if (!apiKey) {
    throw new Error('Missing Anthropic API key. Add it in the chat panel to continue.')
  }

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
  })

  const systemPrompt = buildSystemPrompt(payload)
  const conversation = toAnthropicMessages(payload.messages)

  const response = await client.messages.create({
    model: MODEL_NAME,
    max_tokens: MAX_TOKENS,
    temperature: 0.6,
    system: systemPrompt,
    messages: conversation,
  })

  const assistantText = response.content
    .flatMap(block => (block.type === 'text' ? [block.text] : []))
    .join('\n')
    .trim()

  if (!assistantText) {
    throw new Error('Claude did not return any text. Try asking again.')
  }

  const followUpOptions = payload.followUpOptions

  return {
    assistantText,
    followUpOptions,
  }
}
