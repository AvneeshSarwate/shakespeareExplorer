<script setup lang="ts">
import { onMounted } from 'vue'
import PlaySidebar from './components/PlaySidebar.vue'
import SceneControls from './components/SceneControls.vue'
import SceneViewer from './components/SceneViewer.vue'
import { usePlayStore } from './stores/usePlayStore'

const store = usePlayStore()

const plays = store.plays
const sidebarOpen = store.sidebarOpen
const currentPlay = store.currentPlay
const currentScene = store.currentScene
const error = store.error

onMounted(() => {
  if (!plays.value.length) {
    store.init()
  }
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
      <PlaySidebar />

      <main class="main" v-if="currentPlay">
        <section class="play-header">
          <h2>{{ currentPlay.name }}</h2>
          <p class="play-details">
            <span>{{ currentPlay.genre }}</span>
            <span aria-hidden="true">·</span>
            <span>{{ currentPlay.characters.length }} characters</span>
          </p>
        </section>

        <SceneControls />

        <SceneViewer v-if="currentScene" />
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
