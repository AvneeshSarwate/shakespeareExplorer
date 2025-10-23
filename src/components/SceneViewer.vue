<script setup lang="ts">
import { usePlayStore } from '../stores/usePlayStore'
import { useScrollRestoration } from '../composables/useScrollRestoration'

const store = usePlayStore()

const currentAct = store.currentAct
const currentScene = store.currentScene
const lines = store.lines
const highlight = store.highlight

const { containerRef } = useScrollRestoration(store)
</script>

<template>
  <section class="scene">
    <header class="scene-header">
      <h3>Act {{ currentAct?.number }}, Scene {{ currentScene?.number }}</h3>
      <p class="scene-meta">
        {{ currentScene?.lines.length ?? 0 }} lines ·
        <span>{{ lines.length }} shown</span>
      </p>
    </header>
    <div class="scene-scroll" ref="containerRef">
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
</template>
