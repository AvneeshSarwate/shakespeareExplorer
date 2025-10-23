import { computed, reactive, ref, watch, type ComputedRef } from 'vue'
import {
  DEFAULT_FOLLOW_UP_OPTIONS,
  createChatIdentifier,
  createMessageId,
  type ExplainChatContextLine,
  type ExplainChatMessage,
  type ExplainChatSession,
  type ExplainChatSortMode,
} from '../types/explain'
import { requestLineExplanation } from '../services/explainChat'

type OpenSessionArgs = {
  playId: string
  playName: string
  actNumber: number
  sceneNumber: number
  lineGlobalIndex: number
  lineSentence: number
  speaker: string
  lineText: string
  contextWindow: ExplainChatContextLine[]
}

type VisibilitySyncArgs = {
  playId: string
  actNumber: number
  sceneNumber: number
  visibleGlobalLineIds: number[]
}

const SORT_STORAGE_KEY = 'explain-chat-sort-mode'
const hasWindow = typeof window !== 'undefined'

const DEFAULT_USER_TEXT = 'Explain this line to me'

function loadSortMode(): ExplainChatSortMode {
  if (!hasWindow) return 'updated'
  const stored = window.localStorage.getItem(SORT_STORAGE_KEY)
  if (stored === 'created' || stored === 'play') return stored
  return 'updated'
}

function persistSortMode(mode: ExplainChatSortMode) {
  if (!hasWindow) return
  window.localStorage.setItem(SORT_STORAGE_KEY, mode)
}

function createSession(args: OpenSessionArgs): ExplainChatSession {
  return {
    id: createChatIdentifier({
      playId: args.playId,
      actNumber: args.actNumber,
      sceneNumber: args.sceneNumber,
      lineGlobalIndex: args.lineGlobalIndex,
    }),
    playId: args.playId,
    playName: args.playName,
    actNumber: args.actNumber,
    sceneNumber: args.sceneNumber,
    lineGlobalIndex: args.lineGlobalIndex,
    lineSentence: args.lineSentence,
    speaker: args.speaker,
    lineText: args.lineText,
    contextWindow: args.contextWindow,
    status: 'open',
    visibility: 'visible',
    messages: reactive<ExplainChatMessage[]>([]),
    followUpOptions: [...DEFAULT_FOLLOW_UP_OPTIONS],
    pending: false,
    error: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    hasHistory: false,
    defaultUserText: DEFAULT_USER_TEXT,
  }
}

function sortSessions(sessions: ExplainChatSession[], mode: ExplainChatSortMode) {
  const copy = [...sessions]
  switch (mode) {
    case 'created':
      copy.sort((a, b) => b.createdAt - a.createdAt)
      break
    case 'play':
      copy.sort((a, b) => {
        if (a.playName !== b.playName) return a.playName.localeCompare(b.playName)
        if (a.actNumber !== b.actNumber) return a.actNumber - b.actNumber
        if (a.sceneNumber !== b.sceneNumber) return a.sceneNumber - b.sceneNumber
        return a.lineSentence - b.lineSentence
      })
      break
    case 'updated':
    default:
      copy.sort((a, b) => b.updatedAt - a.updatedAt)
      break
  }
  return copy
}

const explainChatStoreSymbol = Symbol('ExplainChatStore')

type ExplainChatStoreApi = {
  sessions: ExplainChatSession[]
  openSession: ComputedRef<ExplainChatSession | null>
  sortedSessions: ComputedRef<ExplainChatSession[]>
  panelOpen: ComputedRef<boolean>
  sortMode: ComputedRef<ExplainChatSortMode>
  pendingFocusSessionId: ComputedRef<string | null>
  openSessionId: ComputedRef<string | null>
  apiKey: ComputedRef<string>
  getSessionById(sessionId: string): ExplainChatSession | null
  openSessionAtLine(args: OpenSessionArgs): string
  collapseSession(sessionId: string): void
  closeSession(sessionId: string): void
  sendMessage(sessionId: string, userVisibleText: string): Promise<void>
  setError(sessionId: string, errorMessage: string | null): void
  togglePanel(): void
  openPanel(): void
  closePanel(): void
  setSortMode(mode: ExplainChatSortMode): void
  requestFocus(sessionId: string): void
  clearPendingFocus(sessionId: string): void
  syncVisibility(args: VisibilitySyncArgs): void
  setApiKey(key: string): void
}

export function useExplainChatStore() {
  const existingStore = (useExplainChatStore as any)[
    explainChatStoreSymbol
  ] as ExplainChatStoreApi | undefined
  if (existingStore) {
    return existingStore
  }

  const sessions = reactive<ExplainChatSession[]>([])
  const panelOpen = ref(false)
  const sortMode = ref<ExplainChatSortMode>(loadSortMode())
  const pendingFocusSessionId = ref<string | null>(null)
  const apiKey = ref('')

  function getSessionById(sessionId: string) {
    return sessions.find(session => session.id === sessionId) ?? null
  }

  function ensureSingleOpen(targetId: string) {
    sessions.forEach(session => {
      if (session.id !== targetId && session.status === 'open') {
        session.status = 'collapsed'
      }
    })
  }

  function touchSession(session: ExplainChatSession) {
    session.updatedAt = Date.now()
  }

  function activateSession(args: OpenSessionArgs) {
    const sessionId = createChatIdentifier({
      playId: args.playId,
      actNumber: args.actNumber,
      sceneNumber: args.sceneNumber,
      lineGlobalIndex: args.lineGlobalIndex,
    })

    let session = getSessionById(sessionId)
    if (!session) {
      session = createSession(args)
      sessions.push(session)
    } else {
      session.status = 'open'
      session.visibility = 'visible'
      session.lineText = args.lineText
      session.lineSentence = args.lineSentence
      session.speaker = args.speaker
      session.contextWindow = args.contextWindow
    }

    ensureSingleOpen(sessionId)
    touchSession(session)
    return sessionId
  }

  function collapseSession(sessionId: string) {
    const session = getSessionById(sessionId)
    if (!session) return
    session.status = 'collapsed'
    session.pending = false
    touchSession(session)
  }

  function closeSession(sessionId: string) {
    const index = sessions.findIndex(session => session.id === sessionId)
    if (index === -1) return
    sessions.splice(index, 1)
  }

  async function sendMessage(sessionId: string, userVisibleText: string) {
    const session = getSessionById(sessionId)
    if (!session) return
    const trimmed = userVisibleText.trim()
    if (!trimmed) return

    const key = apiKey.value.trim()
    if (!key) {
      session.error = 'Add your Anthropic API key in the chat panel to start chatting.'
      touchSession(session)
      return
    }

    const message: ExplainChatMessage = {
      id: createMessageId(),
      role: 'user',
      text: trimmed,
      timestamp: Date.now(),
    }
    session.messages.push(message)
    session.pending = true
    session.error = null
    session.hasHistory = true
    touchSession(session)

    try {
      const response = await requestLineExplanation({
        apiKey: key,
        playName: session.playName,
        actNumber: session.actNumber,
        sceneNumber: session.sceneNumber,
        lineSentence: session.lineSentence,
        speaker: session.speaker,
        lineText: session.lineText,
        contextWindow: session.contextWindow,
        messages: session.messages.map(message => ({
          role: message.role === 'assistant' ? 'assistant' : 'user',
          text: message.text,
        })),
        followUpOptions: session.followUpOptions,
      })
      const assistantMessage: ExplainChatMessage = {
        id: createMessageId(),
        role: 'assistant',
        text: response.assistantText,
        timestamp: Date.now(),
      }
      session.messages.push(assistantMessage)
      session.followUpOptions =
        response.followUpOptions?.length > 0
          ? response.followUpOptions
          : session.followUpOptions
      session.pending = false
      touchSession(session)
    } catch (error) {
      session.pending = false
      session.error =
        error instanceof Error ? error.message : 'Unable to fetch explanation.'
      touchSession(session)
    }
  }

  function setError(sessionId: string, errorMessage: string | null) {
    const session = getSessionById(sessionId)
    if (!session) return
    session.error = errorMessage
    touchSession(session)
  }

  function togglePanel() {
    panelOpen.value = !panelOpen.value
  }

  function openPanel() {
    panelOpen.value = true
  }

  function closePanel() {
    panelOpen.value = false
  }

  function setSortMode(mode: ExplainChatSortMode) {
    if (sortMode.value === mode) return
    sortMode.value = mode
  }

  function requestFocus(sessionId: string) {
    pendingFocusSessionId.value = sessionId
  }

  function clearPendingFocus(sessionId: string) {
    if (pendingFocusSessionId.value === sessionId) {
      pendingFocusSessionId.value = null
    }
  }

  function syncVisibility(args: VisibilitySyncArgs) {
    sessions.forEach(session => {
      if (
        session.playId === args.playId &&
        session.actNumber === args.actNumber &&
        session.sceneNumber === args.sceneNumber
      ) {
        const visible = args.visibleGlobalLineIds.includes(session.lineGlobalIndex)
        session.visibility = visible ? 'visible' : 'hidden'
        if (!visible && session.status === 'open') {
          session.status = 'collapsed'
        }
      }
    })
  }

  const sortedSessions = computed(() => sortSessions(sessions, sortMode.value))

  const currentOpenSession = computed(
    () => sessions.find(session => session.status === 'open') ?? null,
  )

  watch(
    sortMode,
    mode => {
      persistSortMode(mode)
    },
    { immediate: true },
  )

  const api: ExplainChatStoreApi = {
    sessions,
    openSession: currentOpenSession,
    sortedSessions,
    panelOpen: computed(() => panelOpen.value),
    sortMode: computed(() => sortMode.value),
    pendingFocusSessionId: computed(() => pendingFocusSessionId.value),
    openSessionId: computed(() => currentOpenSession.value?.id ?? null),
    apiKey: computed(() => apiKey.value),
    getSessionById,
    openSessionAtLine(args: OpenSessionArgs) {
      return activateSession(args)
    },
    collapseSession,
    closeSession,
    sendMessage,
    setError,
    togglePanel,
    openPanel,
    closePanel,
    setSortMode,
    requestFocus,
    clearPendingFocus,
    syncVisibility,
    setApiKey(value: string) {
      apiKey.value = value.trim()
    },
  }

  ;(useExplainChatStore as any)[explainChatStoreSymbol] = api
  return api
}
