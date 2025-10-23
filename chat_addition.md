# Explain Chat Feature Plan

## Goals
- Add an inline “Explain” affordance for every rendered line in `SceneViewer` with minimal visual clutter.
- Launch a contextual, anchored chat experience scoped to the selected play/act/scene/line, including ±20 lines of context.
- Keep the chat UI reusable (stateless component) and make chat state/session management centralized so only one chat window is expanded at a time.
- Provide affordances to collapse/reopen chats from the originating line and a global list of active questions for navigation.

## Work Breakdown
1. **Chat session data model**
   - Introduce a `ChatSession` type (id, playId, act, scene, lineId/globalIndex, displayLineNumber, anchor metadata, messages, status `open|collapsed`, timestamps).
   - Define a `ChatMessage` type with role (`user|assistant|system`), text, optional metadata (e.g., request payload, pending state).
   - Track additional UI-only flags such as `isPendingFirstResponse`, `error`, and `followUpsShown`.
   - Store the ±20 line context snapshot and the canonical LLM prompt payload on the session for deterministic retriggers.

2. **Chat state management**
   - Create a dedicated composable/store (e.g., `useExplainChatStore.ts`) using `reactive` state similar to existing `usePlayStore`.
   - Responsibilities:
     - `openSession({ play, act, scene, line, contextLines, anchorRect }): sessionId`.
     - Ensure only one `status === 'open'` at a time (auto-collapse or close others before activating the new one).
     - Enforce one session per line: re-use the existing session if the same line is clicked again, and surface a distinct collapsed marker style to indicate the presence of history.
     - `collapseSession(id)` (keep marker reference), `expandSession(id, anchorRect)` (update anchor on reopen), `closeSession(id)` (remove session and marker).
     - `recordMessage(id, message)`, `setPending(id, boolean)`, `setError(id, err?)`.
     - Maintain ordered `sessions` array for rendering the global list and equality checks.
   - Expose selectors for: currently open session, collapsed markers per scene, sessions filtered by play/scene (for cleanup when switching plays).
   - Watch `usePlayStore` selections to auto-collapse or archive sessions whose play/scene goes out of scope; keep data so the global list can reactivate them by switching play/scene through the play store APIs.

3. **Scene viewer integration**
   - Augment line rendering in `SceneViewer.vue`:
     - Append an explain button inside each `line-item`, positioned inline with the metadata block.
     - Default visual: circular plus icon; on hover/focus swap to text label “Explain line”.
     - Capture DOM refs per line to compute `getBoundingClientRect()` and pass to chat store on open/expand for anchoring.
     - Prepare the ±20 line context (slice by index from `currentScene.lines`) and pass structural metadata (play name, act number, scene number, speaker, etc.) when calling `openSession`.
   - Render collapsed markers inline with the originating line when the session is not open (e.g., a badge or small icon). Clicking marker re-expands the stored session.
   - Use `Teleport` (to `body`) and absolute positioning for the open chat overlay. Bind inline styles based on stored anchor rect plus offsets so the chat floats right of the text without covering line endings.
   - Listen to scroll/resize of the `.scene-scroll` container and window to recompute anchor rects for the active chat.
   - When filtering hides a line, remove its open chat: auto-collapse and clear the anchor so the popup closes. Candidate implementations for hiding behavior:
     - *CSS only:* rely on `display: none` when `v-for` excludes the line; chat component would disappear naturally, but state cleanup still needs JS to avoid stale anchors (not sufficient by itself).
     - *Vue reactivity:* watch the computed `lines` array and detect when the tracked `line.globalIndex` is missing; trigger store cleanup and close the session (recommended).
     - *Mutation observer:* observe DOM removal of the anchored element and react (overkill; stick with store-based detection).

4. **Stateless chat component**
   - Create `components/ExplainChat.vue` that accepts props: `session`, `contextSummary`, `followUps`, `pending`, `error`, `positionStyle`, and emits `send`, `collapse`, `close`, `selectFollowUp`, `retry`.
   - Composition:
     - Header: play/act/scene/line metadata, close and collapse buttons.
     - Body: message list (render messages with role-based styling), initial input disabled template showing “Explain this line to me” for the first user message.
     - Footer: input area (prefilled placeholder “Explain this line to me” but actual outbound payload built upstream), send button, follow-up buttons shown after first assistant response (e.g., “Connect this to the scene”, “What is the subtext?”, “How might an actor deliver it?”).
   - Component makes no direct API calls; relies on props/events to stay stateless and reusable.

5. **LLM request pipeline**
   - Implement a service module (`services/explainChat.ts`) handling the async call:
     - Build prompt payload: include play title, act, scene, speaker, the selected line text, ±20 line context (with line numbers), and user-visible question (“Explain this line to me”) plus hidden instructions to respond pedagogically.
     - For now, use a placeholder template for the hidden first user prompt (e.g., `"Explain this line to me." + detailed context block`) and mark a TODO to refine wording once UX copy is finalized.
     - Support injecting follow-up questions by appending to the conversation history.
     - Return structured assistant responses and suggested follow-ups (if any). For now, hardcode follow-up options in UI but keep hook for service-provided suggestions later.
     - Surface loading and error states back through the chat store.
     - Reference `pianoRollChat.example.ts` for patterns when structuring the chat send flow, reactive state, and tool/result handling (adapted to the Shakespeare context without the piano roll specifics).
   - Decide on actual endpoint (if none yet, stub for now and mark TODO).

6. **Global active-questions list**
   - Add a desktop-only popup panel (modal or anchored drawer) that lists active sessions, supports vertical scrolling, and can be toggled from the main UI.
   - Include sort controls in the popup header: by last updated timestamp (default), by creation time, or alphabetically by play → act → scene → line.
   - Each entry shows play name, act/scene, line number, and a status icon (open vs collapsed vs awaiting reply).
   - Clicking an entry:
     - Calls into `usePlayStore` to switch to the referenced play/act/scene if needed (reusing existing `select*` APIs).
     - After navigation/scroll restore, re-expands the session and scrolls the line into view (use `containerRef` from `useScrollRestoration` plus `scrollIntoView` on the line element).
   - Provide affordances to close sessions from the list and remember the last selected sort mode in store state.

7. **Styling & layout safeguards**
   - Extend `src/style.css` with BEM-ish class names (`.line-explain-button`, `.line-explain-marker`, `.explain-chat`, etc.).
   - Ensure the chat overlay sits to the right of the text:
     - Reserve right-side gutter in `.scene-scroll` (e.g., add `padding-right` or `margin-right`).
     - Use max-width/height and box-shadow consistent with existing aesthetics; add arrow/connector triangle pointing to the originating line.
   - Define hover/focus states accessible via keyboard (tab to button → show tooltip text). Provide `aria-label` and screen-reader-only text.
   - Treat the product as desktop-only; optimize for wider layouts while handling moderate window resizing without overlapping inline controls.

8. **Lifecycle & cleanup**
   - On play change or scene change, persist current open session anchor state, collapse it, but keep session in store so the global list still shows it (with metadata indicating it’s out-of-view). When the user reopens via the list, rely on `selectPlay/Act/Scene` to restore context before rendering the chat.
   - Remove sessions when their base play/scene no longer exists (e.g., dataset reload).
   - Hook into `onUnmounted` in `SceneViewer` to unregister scroll listeners and avoid memory leaks.

## Outstanding Questions / To Validate
- Confirm desired endpoint for the LLM call and authentication (stub vs real API).
- Confirm maximum number of simultaneously tracked sessions; assume small (handful) and no pagination needed.
- Decide whether the active-questions popup’s sort choice should persist across reloads or reset each session.
