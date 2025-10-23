<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type ComponentPublicInstance,
} from 'vue'
import { usePlayStore } from '../stores/usePlayStore'
import { useScrollRestoration } from '../composables/useScrollRestoration'
import ExplainChat from './ExplainChat.vue'
import { useExplainChatStore } from '../stores/useExplainChatStore'
import type { ExplainChatContextLine, ExplainChatSession } from '../types/explain'
import type { Line } from '../types/plays'

const store = usePlayStore()
const chatStore = useExplainChatStore()

const currentPlay = store.currentPlay
const currentAct = store.currentAct
const currentScene = store.currentScene
const lines = store.lines
const highlight = store.highlight

const { containerRef } = useScrollRestoration(store)

const lineRefs = new Map<number, HTMLElement>()
const layoutTick = ref(0)

function triggerLayoutUpdate() {
  layoutTick.value++
}

function resolveElement(
  element: Element | ComponentPublicInstance | null,
): HTMLElement | null {
  if (!element) return null
  if (element instanceof HTMLElement) return element
  const maybe = (element as ComponentPublicInstance).$el
  return maybe instanceof HTMLElement ? maybe : null
}

function setLineRef(
  element: Element | ComponentPublicInstance | null,
  globalIndex: number,
) {
  const htmlElement = resolveElement(element)
  const previous = lineRefs.get(globalIndex) ?? null
  if (htmlElement) {
    if (previous === htmlElement) return
    lineRefs.set(globalIndex, htmlElement)
    triggerLayoutUpdate()
    return
  }
  if (previous) {
    lineRefs.delete(globalIndex)
    triggerLayoutUpdate()
  }
}

onMounted(() => {
  window.addEventListener('resize', triggerLayoutUpdate)
  window.addEventListener('scroll', triggerLayoutUpdate, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', triggerLayoutUpdate)
  window.removeEventListener('scroll', triggerLayoutUpdate, true)
  lineRefs.clear()
})

watch(
  containerRef,
  (element, previous) => {
    previous?.removeEventListener('scroll', triggerLayoutUpdate)
    element?.addEventListener('scroll', triggerLayoutUpdate)
  },
  { immediate: true },
)

const sessionMap = computed(() => {
  const map = new Map<number, ExplainChatSession>()
  const play = currentPlay.value
  const act = currentAct.value
  const scene = currentScene.value
  if (!play || !act || !scene) return map
  chatStore.sessions.forEach(session => {
    if (
      session.playId === play.id &&
      session.actNumber === act.number &&
      session.sceneNumber === scene.number
    ) {
      map.set(session.lineGlobalIndex, session)
    }
  })
  return map
})

const visibleLineIds = computed(() => lines.value.map(line => line.globalIndex))

watch(
  visibleLineIds,
  ids => {
    const play = currentPlay.value
    const act = currentAct.value
    const scene = currentScene.value
    if (!play || !act || !scene) return
    chatStore.syncVisibility({
      playId: play.id,
      actNumber: act.number,
      sceneNumber: scene.number,
      visibleGlobalLineIds: ids,
    })
    triggerLayoutUpdate()
  },
  { immediate: true },
)

watch(
  () => chatStore.openSessionId.value,
  () => {
    nextTick(() => triggerLayoutUpdate())
  },
)

watch(
  () => lines.value.length,
  () => {
    nextTick(() => triggerLayoutUpdate())
  },
)

function buildContextWindow(globalIndex: number): ExplainChatContextLine[] | null {
  const scene = currentScene.value
  if (!scene) return null
  const sceneLines = scene.lines
  const targetIndex = sceneLines.findIndex(line => line.globalIndex === globalIndex)
  if (targetIndex === -1) return null
  const start = Math.max(0, targetIndex - 20)
  const end = Math.min(sceneLines.length - 1, targetIndex + 20)
  return sceneLines.slice(start, end + 1).map(line => ({
    globalIndex: line.globalIndex,
    sentence: line.sentence,
    character: line.character,
    text: line.text,
  }))
}

function sessionForLine(globalIndex: number) {
  return sessionMap.value.get(globalIndex) ?? null
}

function explainButtonClasses(globalIndex: number) {
  const session = sessionForLine(globalIndex)
  return {
    'has-session': !!session,
    'has-history': !!session?.hasHistory,
    'is-open': session?.status === 'open',
  }
}

function explainButtonLabel(globalIndex: number) {
  const session = sessionForLine(globalIndex)
  if (!session) return 'Explain line'
  if (session.status === 'open') return 'Chat open'
  if (session.hasHistory) return 'Resume chat'
  return 'Explain line'
}

function handleExplain(line: Line) {
  const play = currentPlay.value
  const act = currentAct.value
  const scene = currentScene.value
  if (!play || !act || !scene) return
  const contextWindow = buildContextWindow(line.globalIndex)
  if (!contextWindow) return
  chatStore.openSessionAtLine({
    playId: play.id,
    playName: play.name,
    actNumber: act.number,
    sceneNumber: scene.number,
    lineGlobalIndex: line.globalIndex,
    lineSentence: line.sentence,
    speaker: line.character,
    lineText: line.text,
    contextWindow,
  })
  nextTick(() => triggerLayoutUpdate())
}

function handleCollapse(sessionId: string) {
  chatStore.collapseSession(sessionId)
  nextTick(() => triggerLayoutUpdate())
}

function handleClose(sessionId: string) {
  chatStore.collapseSession(sessionId)
  nextTick(() => triggerLayoutUpdate())
}

function handleSend(payload: { sessionId: string; text: string }) {
  chatStore.sendMessage(payload.sessionId, payload.text)
}

function handleFollowUp(payload: { sessionId: string; text: string }) {
  chatStore.sendMessage(payload.sessionId, payload.text)
}

function scrollLineIntoView(globalIndex: number) {
  const element = lineRefs.get(globalIndex)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

watch(
  () => chatStore.pendingFocusSessionId.value,
  async sessionId => {
    if (!sessionId) return
    const session = chatStore.getSessionById(sessionId)
    if (!session) {
      chatStore.clearPendingFocus(sessionId)
      return
    }
    await nextTick()
    const contextWindow = buildContextWindow(session.lineGlobalIndex)
    if (!contextWindow) {
      chatStore.clearPendingFocus(sessionId)
      return
    }
    chatStore.openSessionAtLine({
      playId: session.playId,
      playName: session.playName,
      actNumber: session.actNumber,
      sceneNumber: session.sceneNumber,
      lineGlobalIndex: session.lineGlobalIndex,
      lineSentence: session.lineSentence,
      speaker: session.speaker,
      lineText: session.lineText,
      contextWindow,
    })
    await nextTick()
    scrollLineIntoView(session.lineGlobalIndex)
    triggerLayoutUpdate()
    chatStore.clearPendingFocus(sessionId)
  },
)

const openSession = computed(() => chatStore.openSession.value)

const anchorStyle = computed(() => {
  layoutTick.value
  const session = openSession.value
  if (!session) return null
  const element = lineRefs.get(session.lineGlobalIndex)
  if (!element) return null
  const rect = element.getBoundingClientRect()
  const viewportTop = rect.top + window.scrollY
  const preferredLeft = rect.right + 32
  const width = 360
  const maxLeft = window.innerWidth - width - 24
  const left = Math.max(24, Math.min(preferredLeft, maxLeft))
  const top = Math.max(24, viewportTop - 16)
  return {
    top: `${top}px`,
    left: `${left}px`,
    width: `${width}px`,
  }
})
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
        <li
          v-for="line in lines"
          :key="line.globalIndex"
          class="line-item"
          :ref="element => setLineRef(element, line.globalIndex)"
        >
          <div class="line-meta">
            <div class="line-meta-text">
              <span class="line-index">#{{ line.sentence }}</span>
              <span class="line-speaker">{{ line.character }}</span>
            </div>
            <button
              type="button"
              class="line-explain-button"
              :class="explainButtonClasses(line.globalIndex)"
              @click="handleExplain(line)"
              :aria-pressed="sessionForLine(line.globalIndex)?.status === 'open'"
            >
              <span class="line-explain-icon">
                {{ sessionForLine(line.globalIndex)?.hasHistory ? '++' : '+' }}
              </span>
              <span class="line-explain-label">{{ explainButtonLabel(line.globalIndex) }}</span>
            </button>
          </div>
          <p class="line-text" v-html="highlight(line.text)"></p>
        </li>
      </ol>
      <p v-if="!lines.length" class="status">No lines match this search.</p>
    </div>
  </section>
  <Teleport to="body">
    <ExplainChat
      v-if="openSession && anchorStyle"
      :session="openSession"
      :position-style="anchorStyle"
      @collapse="handleCollapse"
      @close="handleClose"
      @send="handleSend"
      @follow-up="handleFollowUp"
    />
  </Teleport>
</template>
