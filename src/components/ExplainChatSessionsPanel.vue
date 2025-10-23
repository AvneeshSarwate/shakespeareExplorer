<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useExplainChatStore } from '../stores/useExplainChatStore'
import { usePlayStore } from '../stores/usePlayStore'
import type { ExplainChatSession, ExplainChatSortMode } from '../types/explain'

const chatStore = useExplainChatStore()
const playStore = usePlayStore()

const sortOptions: Array<{ value: ExplainChatSortMode; label: string }> = [
  { value: 'updated', label: 'Last updated' },
  { value: 'created', label: 'Date created' },
  { value: 'play', label: 'Play / Act / Scene / Line' },
]

const sessions = computed(() => chatStore.sortedSessions.value)
const panelOpen = computed(() => chatStore.panelOpen.value)
const sortMode = computed(() => chatStore.sortMode.value)
const storedApiKey = computed(() => chatStore.apiKey.value)
const apiKeyDraft = ref(storedApiKey.value)
const apiKeyMissing = computed(() => !storedApiKey.value)

watch(
  storedApiKey,
  value => {
    apiKeyDraft.value = value
  },
  { immediate: true },
)

function handleClose() {
  chatStore.closePanel()
}

function handleSortChange(event: Event) {
  const target = event.target as HTMLSelectElement
  const option = target.value as ExplainChatSortMode
  chatStore.setSortMode(option)
}

function formatMetadata(session: ExplainChatSession) {
  return `Act ${session.actNumber}, Scene ${session.sceneNumber}, line ${session.lineSentence}`
}

function formatStatus(session: ExplainChatSession) {
  if (session.pending) return 'Waiting'
  if (session.status === 'open') return 'Open'
  if (session.visibility === 'hidden') return 'Hidden'
  if (session.hasHistory) return 'Notes saved'
  return 'New'
}

async function ensureSelection(session: ExplainChatSession) {
  if (playStore.selectedPlayId.value !== session.playId) {
    playStore.selectPlay(session.playId)
  }
  if (playStore.selectedActNumber.value !== session.actNumber) {
    playStore.selectAct(session.actNumber, { rememberScroll: false })
  }
  if (playStore.selectedSceneNumber.value !== session.sceneNumber) {
    playStore.selectScene(session.sceneNumber, { rememberScroll: false })
  }
  await nextTick()
}

async function handleSessionClick(session: ExplainChatSession) {
  await ensureSelection(session)
  chatStore.requestFocus(session.id)
  chatStore.closePanel()
}

async function handleReopen(session: ExplainChatSession) {
  await ensureSelection(session)
  chatStore.requestFocus(session.id)
  chatStore.closePanel()
}

function handleRemove(session: ExplainChatSession) {
  chatStore.closeSession(session.id)
}

function handleSaveKey() {
  chatStore.setApiKey(apiKeyDraft.value)
}

function handleClearKey() {
  apiKeyDraft.value = ''
  chatStore.setApiKey('')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="panelOpen" class="chat-panel-overlay" @click.self="handleClose">
      <section class="chat-panel" role="dialog" aria-modal="true" aria-label="Active chats">
        <header class="chat-panel__header">
          <h2>Active chats</h2>
          <div class="chat-panel__controls">
            <label class="chat-panel__sort">
              Sort:
              <select :value="sortMode" @change="handleSortChange">
                <option v-for="option in sortOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>
            <button type="button" class="icon-button" @click="handleClose" aria-label="Close panel">
              ✕
            </button>
          </div>
        </header>

        <div class="chat-panel__body" role="list">
          <section class="chat-panel__api" aria-label="Anthropic API key">
            <label class="chat-panel__api-label" for="chat-panel-api-key">Anthropic API key</label>
            <div class="chat-panel__api-row">
              <input
                id="chat-panel-api-key"
                v-model="apiKeyDraft"
                type="password"
                class="chat-panel__input"
                placeholder="sk-ant-..."
              />
              <div class="chat-panel__api-actions">
                <button type="button" class="chat-panel__secondary" @click="handleSaveKey">
                  Save
                </button>
                <button type="button" class="chat-panel__secondary" @click="handleClearKey">
                  Clear
                </button>
              </div>
            </div>
            <p class="chat-panel__api-hint">
              Provide an Anthropic API key to chat with Claude (kept only for this session; not stored).
            </p>
          </section>
          <p v-if="!sessions.length" class="chat-panel__empty">
            No chats yet — ask about a line to get started.
          </p>
          <article
            v-for="session in sessions"
            :key="session.id"
            role="listitem"
            class="chat-panel__row"
          >
            <div class="chat-panel__row-main">
              <button type="button" class="chat-panel__row-button" @click="handleSessionClick(session)">
                <span class="chat-panel__row-title">{{ session.playName }}</span>
                <span class="chat-panel__row-meta">{{ formatMetadata(session) }}</span>
              </button>
              <span :class="['chat-panel__status', `is-${session.status}`, session.visibility === 'hidden' ? 'is-hidden' : '']">
                {{ formatStatus(session) }}
              </span>
            </div>
            <div class="chat-panel__row-actions">
              <button
                type="button"
                class="chat-panel__secondary"
                @click="handleReopen(session)"
              >
                Reopen
              </button>
              <button type="button" class="chat-panel__secondary" @click="handleRemove(session)">
                Remove
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>
  </Teleport>
</template>
