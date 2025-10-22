<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

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

const plays = ref<Play[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const playSearch = ref('')
const lineSearch = ref('')
const selectedPlayId = ref<string | null>(null)
const selectedActNumber = ref<number | null>(null)
const selectedSceneNumber = ref<number | null>(null)

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

async function loadData() {
  loading.value = true
  error.value = null
  try {
    const response = await fetch(dataUrl.value)
    if (!response.ok) throw new Error(`Failed to load plays (${response.status})`)
    const data = (await response.json()) as { plays: Play[] }
    plays.value = data.plays
    if (data.plays.length) {
      selectedPlayId.value = data.plays[0].id
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error'
  } finally {
    loading.value = false
  }
}

watch(currentPlay, play => {
  if (!play) return
  const firstAct = play.acts[0]
  selectedActNumber.value = firstAct?.number ?? null
})

watch(currentAct, act => {
  if (!act) return
  const firstScene = act.scenes[0]
  selectedSceneNumber.value = firstScene?.number ?? null
})

watch(acts, newActs => {
  if (!newActs.length) {
    selectedActNumber.value = null
    selectedSceneNumber.value = null
  }
})

watch(scenes, newScenes => {
  if (!newScenes.length) selectedSceneNumber.value = null
})

onMounted(loadData)
</script>

<template>
  <div class="reader-app">
    <header class="masthead">
      <h1>Shakespeare Explorer</h1>
      <p class="tagline">
        A concise reader for the plays, inspired by Tufte’s quiet typography.
      </p>
    </header>

    <div class="layout" v-if="!error">
      <aside class="sidebar">
        <label class="field-label" for="play-search">Search plays</label>
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
            @click="selectedPlayId = play.id"
          >
            <span class="play-title">{{ play.name }}</span>
            <span class="play-meta">{{ play.genre }}</span>
          </button>
        </nav>
      </aside>

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
                @click="selectedActNumber = act.number"
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
                @click="selectedSceneNumber = scene.number"
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
          <ol class="line-list">
            <li v-for="line in lines" :key="line.globalIndex" class="line-item">
              <div class="line-meta">
                <span class="line-speaker">{{ line.character }}</span>
                <span class="line-index">#{{ line.sentence }}</span>
              </div>
              <p class="line-text" v-html="highlight(line.text)"></p>
            </li>
          </ol>
          <p v-if="!lines.length" class="status">No lines match this search.</p>
        </section>
        <p v-else class="status">Select an act and scene to begin reading.</p>
      </main>
      <main class="main" v-else>
        <p class="status">Select a play to continue.</p>
      </main>
    </div>

    <div v-else class="layout">
      <p class="status error">{{ error }}</p>
    </div>
  </div>
</template>
