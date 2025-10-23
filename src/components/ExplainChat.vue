<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ExplainChatMessage, ExplainChatSession } from '../types/explain'

const props = defineProps<{
  session: ExplainChatSession
  positionStyle: Record<string, string> | null
}>()

const emit = defineEmits<{
  (e: 'collapse', sessionId: string): void
  (e: 'close', sessionId: string): void
  (e: 'send', payload: { sessionId: string; text: string }): void
  (e: 'follow-up', payload: { sessionId: string; text: string }): void
}>()

const draft = ref(props.session.defaultUserText)

watch(
  () => props.session.defaultUserText,
  value => {
    if (!props.session.hasHistory) {
      draft.value = value
    }
  },
)

watch(
  () => props.session.status,
  status => {
    if (status === 'open' && !props.session.hasHistory) {
      draft.value = props.session.defaultUserText
    }
  },
)

const disabled = computed(() => props.session.pending || !draft.value.trim())

const assistantMessages = computed(() =>
  props.session.messages.filter(message => message.role === 'assistant'),
)

function handleSubmit() {
  if (disabled.value) return
  emit('send', { sessionId: props.session.id, text: draft.value })
  draft.value = ''
}

function handleFollowUpClick(option: string) {
  emit('follow-up', { sessionId: props.session.id, text: option })
}

const positionBinding = computed(() => props.positionStyle ?? {})

const hasFollowUps = computed(
  () => assistantMessages.value.length > 0 && props.session.followUpOptions.length > 0,
)

const messageKey = (message: ExplainChatMessage) => `${message.id}-${message.role}`
</script>

<template>
  <section class="explain-chat" :style="positionBinding">
    <header class="explain-chat__header">
      <div class="explain-chat__title">
        <strong>{{ session.playName }}</strong>
        <span class="explain-chat__meta">
          Act {{ session.actNumber }}, Scene {{ session.sceneNumber }}, line {{ session.lineSentence }}
        </span>
      </div>
      <div class="explain-chat__actions">
        <button type="button" class="icon-button" @click="emit('collapse', session.id)" aria-label="Collapse chat">
          ▾
        </button>
        <button type="button" class="icon-button" @click="emit('close', session.id)" aria-label="Close chat">
          ✕
        </button>
      </div>
    </header>

    <div class="explain-chat__body">
      <ul class="explain-chat__messages">
        <li v-for="message in session.messages" :key="messageKey(message)" :class="['explain-chat__message', `is-${message.role}`]">
          <span class="explain-chat__message-role">{{ message.role === 'assistant' ? 'Tutor' : 'You' }}</span>
          <p class="explain-chat__message-text">{{ message.text }}</p>
        </li>
      </ul>
      <p v-if="session.pending" class="explain-chat__status">Thinking…</p>
      <p v-if="session.error" class="explain-chat__error" role="alert">{{ session.error }}</p>
    </div>

    <footer class="explain-chat__footer">
      <form class="explain-chat__form" @submit.prevent="handleSubmit">
        <label class="sr-only" :for="`chat-input-${session.id}`">Ask about this line</label>
        <input
          :id="`chat-input-${session.id}`"
          v-model="draft"
          type="text"
          class="explain-chat__input"
          :placeholder="session.defaultUserText"
          :disabled="session.pending"
        />
        <button type="submit" class="explain-chat__send" :disabled="disabled">Send</button>
      </form>
      <div v-if="hasFollowUps" class="explain-chat__suggestions">
        <span class="explain-chat__suggestions-label">Try asking:</span>
        <button
          v-for="option in session.followUpOptions"
          :key="option"
          type="button"
          class="explain-chat__suggestion"
          @click="handleFollowUpClick(option)"
          :disabled="session.pending"
        >
          {{ option }}
        </button>
      </div>
    </footer>
  </section>
</template>
