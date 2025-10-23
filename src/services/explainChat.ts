import type { ExplainChatContextLine } from '../types/explain'

export type ExplainChatRequestPayload = {
  playName: string
  actNumber: number
  sceneNumber: number
  lineSentence: number
  speaker: string
  lineText: string
  contextWindow: ExplainChatContextLine[]
  userVisibleText: string
  followUpOptions: string[]
  hiddenPrompt: string
}

export type ExplainChatResponsePayload = {
  assistantText: string
  followUpOptions: string[]
}

const PLACEHOLDER_SYSTEM_MESSAGE = `You are a thoughtful Shakespeare tutor. Offer concise explanations of the selected line, drawing on the surrounding context and dramatic stakes. Keep the tone invitational and clarify any figurative language.`

function renderContextSnippet(contextWindow: ExplainChatContextLine[]) {
  return contextWindow
    .map(line => {
      const speaker = line.character ? ` (${line.character})` : ''
      return `Line ${line.sentence}${speaker}: ${line.text}`
    })
    .join('\n')
}

export function buildHiddenPrompt(
  payload: Omit<ExplainChatRequestPayload, 'hiddenPrompt'>,
) {
  const context = renderContextSnippet(payload.contextWindow)
  return `${PLACEHOLDER_SYSTEM_MESSAGE}

Play: ${payload.playName}
Act: ${payload.actNumber}
Scene: ${payload.sceneNumber}
Speaker: ${payload.speaker}
Line number: ${payload.lineSentence}
Line text: ${payload.lineText}

Context window:
${context}

Learner request: ${payload.userVisibleText}`
}

export async function requestLineExplanation(
  payload: ExplainChatRequestPayload,
): Promise<ExplainChatResponsePayload> {
  // Placeholder implementation until real LLM wiring is available.
  const { playName, speaker, lineSentence, followUpOptions } = payload
  await new Promise(resolve => setTimeout(resolve, 500))

  const assistantText = [
    `Here’s a quick take on line ${lineSentence} from ${playName}.`,
    `The speaker, ${speaker || 'Unknown'}, is grappling with the moment’s immediate tension.`,
    `This placeholder response stands in for the eventual LLM output.`,
  ].join(' ')

  return {
    assistantText,
    followUpOptions,
  }
}
