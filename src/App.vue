<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

type Line = {
  globalIndex: number
  sentence: number
  character: string
  sex: string | null
  text: string
}

type Scene = {
  number: number
  lines: Line[]
}

type Act = {
  number: number
  scenes: Scene[]
}

type CharacterSummary = {
  name: string
  sex: string | null
}

type Play = {
  id: string
  name: string
  genre: string
  characters: CharacterSummary[]
  acts: Act[]
}

type PlayViewState = {
  act: number | null
  sceneByAct: Record<number, number | null>
  scrollByScene: Record<string, number>
}

const plays = ref<Play[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const playSearch = ref('')
const lineSearch = ref('')
const selectedPlayId = ref<string | null>(null)
const selectedActNumber = ref<number | null>(null)
const selectedSceneNumber = ref<number | null>(null)
const sidebarOpen = ref(true)
const playSnapshots = ref<Record<string, PlayViewState>>({})
const sceneScrollContainer = ref<HTMLDivElement | null>(null)
const restoringState = ref(false)

const dataUrl = computed(() => `${import.meta.env.BASE_URL}data/plays.json`)

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const highlight = computed(() => {
  if (!lineSearch.value.trim()) return (t: string) => t
  const pattern = new RegExp(escapeRegex(lineSearch.value.trim()), 'ig')
  return (text: string) => text.replace(pattern, match => `<mark>${match}</mark>`)
})

const filteredPlays = computed(() => {
  const query = playSearch.value.trim().toLowerCase()
  if (!query) return plays.value
  return plays.value.filter(play =>
    [play.name, play.genre].some(field => field.toLowerCase().includes(query)),
  )
})

const currentPlay = computed(() =>
  plays.value.find(play => play.id === selectedPlayId.value) ?? null,
)

const acts = computed(() => currentPlay.value?.acts ?? [])

const currentAct = computed(() =>
  acts.value.find(act => act.number === selectedActNumber.value) ?? null,
)

const scenes = computed(() => currentAct.value?.scenes ?? [])

const currentScene = computed(() =>
  scenes.value.find(scene => scene.number === selectedSceneNumber.value) ?? null,
)

const lines = computed(() => {
  if (!currentScene.value) return []
  const query = lineSearch.value.trim().toLowerCase()
  if (!query) return currentScene.value.lines
  return currentScene.value.lines.filter(line =>
    line.text.toLowerCase().includes(query) ||
    line.character.toLowerCase().includes(query),
  )
})

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

function updatePlaySnapshot(playId: string, updater: (state: PlayViewState) => PlayViewState) {
  const current = playSnapshots.value[playId] ?? createPlayViewState()
  const next = updater(current)
  if (next === current) return next
  playSnapshots.value = {
    ...playSnapshots.value,
    [playId]: next,
  }
  return next
}

function recordSceneSelection(playId: string, act: number | null, scene: number | null) {
  updatePlaySnapshot(playId, state => {
    const nextSceneByAct =
      act != null
        ? {
            ...state.sceneByAct,
            [act]: scene ?? null,
          }
        : state.sceneByAct
    return {
      ...state,
      act,
      sceneByAct: nextSceneByAct,
    }
  })
}

function recordSceneScroll(
  playId: string,
  act: number | null,
  scene: number | null,
  scroll: number,
) {
  const key = getSceneKey(act, scene)
  if (!key) return
  updatePlaySnapshot(playId, state => ({
    ...state,
    scrollByScene: {
      ...state.scrollByScene,
      [key]: scroll,
    },
  }))
}

function persistCurrentScroll(playIdOverride?: string | null) {
  if (restoringState.value) return
  const playId = playIdOverride ?? selectedPlayId.value
  if (!playId) return
  const container = sceneScrollContainer.value
  if (!container) return
  const act = selectedActNumber.value
  const scene = selectedSceneNumber.value
  recordSceneScroll(playId, act, scene, container.scrollTop)
}

function getStoredScroll(playId: string, act: number | null, scene: number | null) {
  const key = getSceneKey(act, scene)
  if (!key) return 0
  return playSnapshots.value[playId]?.scrollByScene?.[key] ?? 0
}

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

function handleSceneScroll() {
  persistCurrentScroll()
}

function selectPlay(playId: string, rememberCurrent = true) {
  const currentId = selectedPlayId.value
  if (rememberCurrent && currentId && currentId !== playId) {
    persistCurrentScroll(currentId)
    const act = selectedActNumber.value
    const scene = selectedSceneNumber.value
    recordSceneSelection(currentId, act, scene ?? null)
  }
  if (currentId === playId) return
  selectedPlayId.value = playId
}

function selectActNumber(actNumber: number) {
  if (selectedActNumber.value === actNumber) return
  persistCurrentScroll()
  selectedActNumber.value = actNumber
}

function selectSceneNumber(sceneNumber: number) {
  if (selectedSceneNumber.value === sceneNumber) return
  persistCurrentScroll()
  selectedSceneNumber.value = sceneNumber
}

async function loadData() {
  loading.value = true
  error.value = null
  try {
    const response = await fetch(dataUrl.value)
    if (!response.ok) throw new Error(`Failed to load plays (${response.status})`)
    const data = (await response.json()) as { plays: Play[] }
    plays.value = data.plays
    if (!data.plays.length) {
      selectedPlayId.value = null
    } else if (
      !selectedPlayId.value ||
      !data.plays.some(play => play.id === selectedPlayId.value)
    ) {
      const firstPlay = data.plays[0]
      if (firstPlay) selectPlay(firstPlay.id, false)
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error'
  } finally {
    loading.value = false
  }
}

watch(currentPlay, play => {
  if (!play) {
    selectedActNumber.value = null
    selectedSceneNumber.value = null
    return
  }
  if (!play.acts.length) {
    selectedActNumber.value = null
    selectedSceneNumber.value = null
    return
  }
  const state = playSnapshots.value[play.id]
  const actNumbers = play.acts.map(act => act.number)
  const nextAct =
    state?.act != null && actNumbers.includes(state.act)
      ? state.act
      : play.acts[0]?.number ?? null
  if (selectedActNumber.value !== nextAct) {
    selectedActNumber.value = nextAct
  }
})

watch(currentAct, act => {
  if (!act) {
    selectedSceneNumber.value = null
    return
  }
  if (!act.scenes.length) {
    selectedSceneNumber.value = null
    return
  }
  const playId = selectedPlayId.value
  const state = playId ? playSnapshots.value[playId] : null
  const storedScene =
    playId != null && state ? state.sceneByAct?.[act.number] ?? null : null
  const sceneNumbers = act.scenes.map(scene => scene.number)
  const nextScene =
    storedScene != null && sceneNumbers.includes(storedScene)
      ? storedScene
      : act.scenes[0]?.number ?? null
  if (nextScene == null) {
    selectedSceneNumber.value = null
    return
  }
  if (selectedSceneNumber.value !== nextScene) {
    selectedSceneNumber.value = nextScene
  }
})

watch(sceneScrollContainer, (el, prev) => {
  if (prev) prev.removeEventListener('scroll', handleSceneScroll)
  if (el) el.addEventListener('scroll', handleSceneScroll, { passive: true })
})

watch(
  () => [selectedPlayId.value, selectedActNumber.value, selectedSceneNumber.value] as const,
  async ([playId, act, scene]) => {
    if (!playId) return
    recordSceneSelection(playId, act, scene ?? null)
    if (act == null || scene == null) return
    await nextTick()
    const scrollValue = getStoredScroll(playId, act, scene)
    const container = sceneScrollContainer.value
    if (!container) return
    restoringState.value = true
    container.scrollTop = scrollValue
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        restoringState.value = false
      })
    } else {
      restoringState.value = false
    }
  },
  { flush: 'post' },
)

onMounted(loadData)

onBeforeUnmount(() => {
  persistCurrentScroll()
  const el = sceneScrollContainer.value
  if (el) el.removeEventListener('scroll', handleSceneScroll)
})
</script>

<template>
  <div class="reader-app">
    <header class="masthead">
      <h1>Shakespeare Explorer</h1>
      <p class="tagline">
        A concise reader for the plays, inspired by Tufte’s quiet typography.
      </p>
    </header>

    <div class="layout" :class="{ 'sidebar-collapsed': !sidebarOpen }" v-if="!error">
      <div :class="['sidebar-shell', { collapsed: !sidebarOpen }]">
        <aside v-if="sidebarOpen" class="sidebar">
          <div class="sidebar-inner">
            <div class="sidebar-header">
              <label class="field-label" for="play-search">Search plays</label>
              <button
                type="button"
                class="sidebar-toggle open"
                @click="toggleSidebar"
                :aria-expanded="sidebarOpen"
                aria-label="Hide play list"
                aria-controls="play-search"
                title="Hide play list"
              >
                <span aria-hidden="true">‹</span>
              </button>
            </div>
            <input
              id="play-search"
              v-model="playSearch"
              type="search"
              placeholder="Filter by title or genre"
            />

            <nav class="play-list" aria-label="Plays">
              <p v-if="loading" class="status">Loading…</p>
              <p v-else-if="!filteredPlays.length" class="status">No plays match.</p>
              <button
                v-for="play in filteredPlays"
                :key="play.id"
                type="button"
                class="play-item"
                :class="{ active: play.id === selectedPlayId }"
                @click="selectPlay(play.id)"
              >
                <span class="play-title">{{ play.name }}</span>
                <span class="play-meta">{{ play.genre }}</span>
              </button>
            </nav>
          </div>
        </aside>
        <button
          v-else
          type="button"
          class="sidebar-toggle collapsed"
          @click="toggleSidebar"
          :aria-expanded="sidebarOpen"
          aria-label="Show all plays"
          aria-controls="play-search"
          title="Show all plays"
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>

      <main class="main" v-if="currentPlay">
        <section class="play-header">
          <h2>{{ currentPlay.name }}</h2>
          <p class="play-details">
            <span>{{ currentPlay.genre }}</span>
            <span aria-hidden="true">·</span>
            <span>{{ currentPlay.characters.length }} characters</span>
          </p>
        </section>

        <section class="controls" aria-label="Scene controls">
          <div class="control-group">
            <span class="control-label">Act</span>
            <div class="chip-group">
              <button
                v-for="act in acts"
                :key="act.number"
                type="button"
                class="chip"
                :class="{ active: act.number === selectedActNumber }"
                @click="selectActNumber(act.number)"
              >
                {{ act.number }}
              </button>
            </div>
          </div>
          <div class="control-group">
            <span class="control-label">Scene</span>
            <div class="chip-group">
              <button
                v-for="scene in scenes"
                :key="scene.number"
                type="button"
                class="chip"
                :class="{ active: scene.number === selectedSceneNumber }"
                @click="selectSceneNumber(scene.number)"
              >
                {{ scene.number }}
              </button>
            </div>
          </div>
          <div class="control-group wide">
            <label class="control-label" for="line-search">Search lines</label>
            <input
              id="line-search"
              v-model="lineSearch"
              type="search"
              placeholder="Filter dialogue or characters"
            />
          </div>
        </section>

        <section class="scene" v-if="currentScene">
          <header class="scene-header">
            <h3>Act {{ currentAct?.number }}, Scene {{ currentScene.number }}</h3>
            <p class="scene-meta">
              {{ currentScene.lines.length }} lines ·
              <span>{{ lines.length }} shown</span>
            </p>
          </header>
          <div class="scene-scroll" ref="sceneScrollContainer">
            <ol class="line-list">
              <li v-for="line in lines" :key="line.globalIndex" class="line-item">
                <div class="line-meta">
                  <span class="line-index">#{{ line.sentence }}</span>
                  <span class="line-speaker">{{ line.character }}</span>
                </div>
                <p class="line-text" v-html="highlight(line.text)"></p>
              </li>
            </ol>
            <p v-if="!lines.length" class="status">No lines match this search.</p>
          </div>
        </section>
        <p v-else class="status">Select an act and scene to begin reading.</p>
      </main>
      <main class="main" v-else>
        <section class="play-header">
          <h2>Shakespeare Explorer</h2>
          <p class="play-details">Choose a play from the list to begin.</p>
        </section>
        <p class="status">Select a play to continue.</p>
      </main>
    </div>

    <div v-else class="layout">
      <p class="status error">{{ error }}</p>
    </div>
  </div>
</template>
