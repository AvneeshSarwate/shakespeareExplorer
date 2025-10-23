import { computed, reactive, ref } from 'vue'
import type { Act, Play, PlayViewState, Scene } from '../types/plays'

type ScrollProvider = () => number | null

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function createPlayViewState(): PlayViewState {
  return {
    act: null,
    sceneByAct: {},
    scrollByScene: {},
  }
}

function getSceneKey(act: number | null, scene: number | null) {
  if (act == null || scene == null) return null
  return `${act}-${scene}`
}

function createPlayStore() {
  const plays = ref<Play[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)
  const playSearch = ref('')
  const lineSearch = ref('')
  const sidebarOpen = ref(true)
  const selection = reactive({
    playId: null as string | null,
    act: null as number | null,
    scene: null as number | null,
  })
  const snapshots = ref<Record<string, PlayViewState>>({})
  const dataUrl = computed(() => `${import.meta.env.BASE_URL}data/plays.json`)
  const scrollProvider = ref<ScrollProvider | null>(null)

  const playSearchModel = computed({
    get: () => playSearch.value,
    set: value => {
      playSearch.value = value
    },
  })

  const lineSearchModel = computed({
    get: () => lineSearch.value,
    set: value => {
      lineSearch.value = value
    },
  })

  const filteredPlays = computed(() => {
    const query = playSearch.value.trim().toLowerCase()
    if (!query) return plays.value
    return plays.value.filter(play =>
      [play.name, play.genre].some(field => field.toLowerCase().includes(query)),
    )
  })

  const currentPlay = computed<Play | null>(() => {
    if (!selection.playId) return null
    return plays.value.find(play => play.id === selection.playId) ?? null
  })

  const acts = computed<Act[]>(() => currentPlay.value?.acts ?? [])

  const currentAct = computed<Act | null>(() => {
    if (!currentPlay.value) return null
    if (selection.act == null) return null
    return currentPlay.value.acts.find(act => act.number === selection.act) ?? null
  })

  const scenes = computed<Scene[]>(() => currentAct.value?.scenes ?? [])

  const currentScene = computed<Scene | null>(() => {
    if (!currentAct.value) return null
    if (selection.scene == null) return null
    return currentAct.value.scenes.find(scene => scene.number === selection.scene) ?? null
  })

  const highlight = computed(() => {
    const query = lineSearch.value.trim()
    if (!query) return (text: string) => text
    const pattern = new RegExp(escapeRegex(query), 'ig')
    return (text: string) => text.replace(pattern, match => `<mark>${match}</mark>`)
  })

  const lines = computed(() => {
    if (!currentScene.value) return []
    const query = lineSearch.value.trim().toLowerCase()
    if (!query) return currentScene.value.lines
    return currentScene.value.lines.filter(line => {
      return (
        line.text.toLowerCase().includes(query) ||
        line.character.toLowerCase().includes(query)
      )
    })
  })

  function updateSnapshot(playId: string, updater: (state: PlayViewState) => PlayViewState) {
    const current = snapshots.value[playId] ?? createPlayViewState()
    const next = updater(current)
    if (next === current) return next
    snapshots.value = {
      ...snapshots.value,
      [playId]: next,
    }
    return next
  }

  function recordSceneSelection(playId: string, act: number | null, scene: number | null) {
    if (act == null) {
      updateSnapshot(playId, state => ({
        ...state,
        sceneByAct: { ...state.sceneByAct },
      }))
      return
    }
    updateSnapshot(playId, state => ({
      ...state,
      sceneByAct: {
        ...state.sceneByAct,
        [act]: scene ?? null,
      },
    }))
  }

  function recordSceneScroll(
    playId: string,
    act: number | null,
    scene: number | null,
    scroll: number,
  ) {
    const key = getSceneKey(act, scene)
    if (!key) return
    updateSnapshot(playId, state => ({
      ...state,
      scrollByScene: {
        ...state.scrollByScene,
        [key]: scroll,
      },
    }))
  }

  function setActNumber(playId: string | null, actNumber: number | null) {
    selection.act = actNumber
    if (!playId) return
    updateSnapshot(playId, state => ({
      ...state,
      act: actNumber,
    }))
  }

  function setSceneNumber(playId: string | null, sceneNumber: number | null) {
    selection.scene = sceneNumber
    if (!playId) return
    const actNumber = selection.act
    if (actNumber == null) return
    recordSceneSelection(playId, actNumber, sceneNumber)
  }

  function resolveSceneNumber(play: Play, actNumber: number | null) {
    if (actNumber == null) return null
    const act = play.acts.find(item => item.number === actNumber)
    if (!act) return null
    const snapshot = snapshots.value[play.id]
    const stored = snapshot?.sceneByAct?.[actNumber] ?? null
    const sceneNumbers = act.scenes.map(scene => scene.number)
    if (stored != null && sceneNumbers.includes(stored)) return stored
    return act.scenes[0]?.number ?? null
  }

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value
  }

  function selectPlay(playId: string, options: { rememberCurrent?: boolean } = {}) {
    const { rememberCurrent = true } = options
    const currentId = selection.playId
    if (rememberCurrent && currentId && currentId !== playId) {
      persistCurrentScroll(currentId)
      recordSceneSelection(currentId, selection.act, selection.scene)
    }
    if (currentId === playId) return
    selection.playId = playId
    const play = plays.value.find(item => item.id === playId) ?? null
    if (!play) {
      setActNumber(null, null)
      setSceneNumber(null, null)
      return
    }
    const snapshot = snapshots.value[play.id]
    const candidateAct = snapshot?.act
    const nextAct =
      candidateAct != null && play.acts.some(act => act.number === candidateAct)
        ? candidateAct
        : play.acts[0]?.number ?? null
    setActNumber(play.id, nextAct)
    const nextScene = resolveSceneNumber(play, selection.act)
    setSceneNumber(play.id, nextScene)
  }

  function selectAct(actNumber: number, options: { rememberScroll?: boolean } = {}) {
    const { rememberScroll = true } = options
    const play = currentPlay.value
    if (!play) return
    const isValid = play.acts.some(act => act.number === actNumber)
    const resolvedAct = isValid ? actNumber : play.acts[0]?.number ?? null
    if (selection.act === resolvedAct) return
    if (rememberScroll) persistCurrentScroll()
    setActNumber(play.id, resolvedAct)
    const nextScene = resolveSceneNumber(play, selection.act)
    setSceneNumber(play.id, nextScene)
  }

  function selectScene(sceneNumber: number, options: { rememberScroll?: boolean } = {}) {
    const { rememberScroll = true } = options
    const play = currentPlay.value
    if (!play) return
    const act = play.acts.find(item => item.number === selection.act)
    if (!act) return
    const isValid = act.scenes.some(scene => scene.number === sceneNumber)
    const resolvedScene = isValid ? sceneNumber : act.scenes[0]?.number ?? null
    if (selection.scene === resolvedScene) return
    if (rememberScroll) persistCurrentScroll()
    setSceneNumber(play.id, resolvedScene)
  }

  function registerScrollProvider(provider: ScrollProvider) {
    scrollProvider.value = provider
  }

  function unregisterScrollProvider(provider: ScrollProvider) {
    if (scrollProvider.value === provider) {
      scrollProvider.value = null
    }
  }

  function persistCurrentScroll(playIdOverride?: string | null) {
    const provider = scrollProvider.value
    if (!provider) return
    const playId = playIdOverride ?? selection.playId
    const act = selection.act
    const scene = selection.scene
    if (!playId || act == null || scene == null) return
    const scroll = provider()
    if (scroll == null) return
    recordSceneScroll(playId, act, scene, scroll)
  }

  function getStoredScroll(playId: string, act: number | null, scene: number | null) {
    const key = getSceneKey(act, scene)
    if (!key) return 0
    return snapshots.value[playId]?.scrollByScene?.[key] ?? 0
  }

  async function init() {
    loading.value = true
    error.value = null
    try {
      const response = await fetch(dataUrl.value)
      if (!response.ok) throw new Error(`Failed to load plays (${response.status})`)
      const data = (await response.json()) as { plays: Play[] }
      plays.value = data.plays
      if (!data.plays.length) {
        selection.playId = null
        setActNumber(null, null)
        setSceneNumber(null, null)
        return
      }
      const currentId = selection.playId
      if (!currentId || !data.plays.some(play => play.id === currentId)) {
        const first = data.plays[0]
        if (first) selectPlay(first.id, { rememberCurrent: false })
      } else {
        const play = data.plays.find(item => item.id === currentId) ?? null
        if (play) {
          const snapshot = snapshots.value[play.id]
          const candidateAct = snapshot?.act
          const nextAct =
            candidateAct != null && play.acts.some(act => act.number === candidateAct)
              ? candidateAct
              : play.acts[0]?.number ?? null
          setActNumber(play.id, nextAct)
          const nextScene = resolveSceneNumber(play, selection.act)
          setSceneNumber(play.id, nextScene)
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
    } finally {
      loading.value = false
    }
  }

  return {
    plays,
    loading,
    error,
    filteredPlays,
    currentPlay,
    acts,
    currentAct,
    scenes,
    currentScene,
    lines,
    highlight,
    sidebarOpen,
    playSearchModel,
    lineSearchModel,
    selectedPlayId: computed(() => selection.playId),
    selectedActNumber: computed(() => selection.act),
    selectedSceneNumber: computed(() => selection.scene),
    init,
    selectPlay,
    selectAct,
    selectScene,
    toggleSidebar,
    registerScrollProvider,
    unregisterScrollProvider,
    persistCurrentScroll,
    getStoredScroll,
  }
}

export type PlayStore = ReturnType<typeof createPlayStore>

let store: PlayStore | null = null

export function usePlayStore() {
  if (!store) {
    store = createPlayStore()
  }
  return store
}
