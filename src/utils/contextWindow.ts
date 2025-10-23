import type { ExplainChatContextLine } from '../types/explain'
import type { Play } from '../types/plays'

type IndexedLine = ExplainChatContextLine & {
  /** Position of the line within the flattened play */
  __index: number
}

function flattenPlayLines(play: Play): IndexedLine[] {
  const flattened: IndexedLine[] = []
  let counter = 0
  for (const act of play.acts) {
    for (const scene of act.scenes) {
      for (const line of scene.lines) {
        flattened.push({
          globalIndex: line.globalIndex,
          sentence: line.sentence,
          character: line.character,
          text: line.text,
          __index: counter++,
        })
      }
    }
  }
  return flattened
}

function findLineIndex(lines: IndexedLine[], globalIndex: number) {
  return lines.findIndex(line => line.globalIndex === globalIndex)
}

function sliceContextWindow(
  lines: IndexedLine[],
  targetIndex: number,
  radius: number,
): ExplainChatContextLine[] {
  const start = Math.max(0, targetIndex - radius)
  const end = Math.min(lines.length - 1, targetIndex + radius)
  return lines.slice(start, end + 1).map(({ __index: _ignored, ...line }) => line)
}

export function buildContextWindowForPlay(
  play: Play | null,
  globalIndex: number,
  radius = 20,
): ExplainChatContextLine[] {
  if (!play) return []
  const flattened = flattenPlayLines(play)
  if (!flattened.length) return []
  const targetIndex = findLineIndex(flattened, globalIndex)
  if (targetIndex === -1) return []
  return sliceContextWindow(flattened, targetIndex, radius)
}
