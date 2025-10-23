<script setup lang="ts">
import { usePlayStore } from '../stores/usePlayStore'

const store = usePlayStore()

const sidebarOpen = store.sidebarOpen
const loading = store.loading
const filteredPlays = store.filteredPlays
const playSearch = store.playSearchModel
const selectedPlayId = store.selectedPlayId

function handleToggle() {
  store.toggleSidebar()
}

function handleSelect(playId: string) {
  store.selectPlay(playId)
}
</script>

<template>
  <div :class="['sidebar-shell', { collapsed: !sidebarOpen }]">
    <aside v-if="sidebarOpen" class="sidebar">
      <div class="sidebar-inner">
        <div class="sidebar-header">
          <label class="field-label" for="play-search">Search plays</label>
          <button
            type="button"
            class="sidebar-toggle open"
            @click="handleToggle"
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
            @click="handleSelect(play.id)"
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
      @click="handleToggle"
      :aria-expanded="sidebarOpen"
      aria-label="Show all plays"
      aria-controls="play-search"
      title="Show all plays"
    >
      <span aria-hidden="true">›</span>
    </button>
  </div>
</template>
