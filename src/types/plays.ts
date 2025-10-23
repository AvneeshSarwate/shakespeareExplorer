export type Line = {
  globalIndex: number
  sentence: number
  character: string
  sex: string | null
  text: string
}

export type Scene = {
  number: number
  lines: Line[]
}

export type Act = {
  number: number
  scenes: Scene[]
}

export type CharacterSummary = {
  name: string
  sex: string | null
}

export type Play = {
  id: string
  name: string
  genre: string
  characters: CharacterSummary[]
  acts: Act[]
}

export type PlayViewState = {
  act: number | null
  sceneByAct: Record<number, number | null>
  scrollByScene: Record<string, number>
}
