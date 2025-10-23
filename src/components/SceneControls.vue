<script setup lang="ts">
import { computed } from 'vue'
import { usePlayStore } from '../stores/usePlayStore'
import { useExplainChatStore } from '../stores/useExplainChatStore'

const store = usePlayStore()
const chatStore = useExplainChatStore()

const acts = store.acts
const scenes = store.scenes
const selectedActNumber = store.selectedActNumber
const selectedSceneNumber = store.selectedSceneNumber
const lineSearch = store.lineSearchModel

const activeChatCount = computed(() => chatStore.sessions.length)
const hasActiveChats = computed(() => activeChatCount.value > 0)

function handleActSelect(actNumber: number) {
  store.selectAct(actNumber)
}

function handleSceneSelect(sceneNumber: number) {
  store.selectScene(sceneNumber)
}

function handleChatPanelToggle() {
  chatStore.togglePanel()
}
</script>

<template>
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
          @click="handleActSelect(act.number)"
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
          @click="handleSceneSelect(scene.number)"
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
    <div class="control-group chat-summary">
      <span class="control-label">Questions</span>
      <button
        type="button"
        class="chat-summary__button"
        :class="{ active: hasActiveChats }"
        @click="handleChatPanelToggle"
      >
        <span>Active chats</span>
        <span class="chat-summary__count">{{ activeChatCount }}</span>
      </button>
    </div>
  </section>
</template>
