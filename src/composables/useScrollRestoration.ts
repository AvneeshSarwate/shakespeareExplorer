import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { PlayStore } from '../stores/usePlayStore'

export function useScrollRestoration(store: PlayStore) {
  const containerRef = ref<HTMLDivElement | null>(null)
  const restoring = ref(false)

  const provider = () => containerRef.value?.scrollTop ?? null
  store.registerScrollProvider(provider)

  function handleScroll() {
    if (restoring.value) return
    store.persistCurrentScroll()
  }

  watch(containerRef, (el, prev) => {
    if (prev) prev.removeEventListener('scroll', handleScroll)
    if (el) el.addEventListener('scroll', handleScroll, { passive: true })
  })

  watch(
    () =>
      [
        store.selectedPlayId.value,
        store.selectedActNumber.value,
        store.selectedSceneNumber.value,
      ] as const,
    async ([playId, act, scene]) => {
      if (!playId || act == null || scene == null) return
      await nextTick()
      const el = containerRef.value
      if (!el) return
      restoring.value = true
      el.scrollTop = store.getStoredScroll(playId, act, scene)
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => {
          restoring.value = false
        })
      } else {
        restoring.value = false
      }
    },
    { flush: 'post', immediate: true },
  )

  onBeforeUnmount(() => {
    store.persistCurrentScroll()
    const el = containerRef.value
    if (el) el.removeEventListener('scroll', handleScroll)
    store.unregisterScrollProvider(provider)
  })

  return {
    containerRef,
  }
}
