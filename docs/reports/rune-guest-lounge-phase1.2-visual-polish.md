# Rune Guest Lounge Phase 1.2 — Visual / Conversation Polish

## Scope and ownership

Production changes are limited to `src/components/auth/GuestLounge.tsx` and `src/components/auth/GuestLounge.css`. AuthGate still mounts the same in-memory guest session and selects its provider. The adapter, credential resolver, transport, private-context exclusion and session lifetime are unchanged. The static reception message is rendered as an article but is not added to the request transcript or stored messages.

No Git cleanup, checkpoints, recovery edits, new stores, routes, features, tools, memory access, or persistence were introduced. Protected source hashes are in `evidence/rune-guest-lounge-phase1.2/protected-source-hashes.json`.

## Presentation changes

- Desktop uses intrinsic content height, a 520px minimum (viewport-capped), 400px width and `min(720px, 100dvh - 48px)` maximum. Mobile retains the inset bottom sheet with `min(420px, 100vw - 24px)` width, 58dvh minimum and 72dvh maximum. Short viewports retain the existing keyboard-height accommodation and safe-area padding.
- Header and composer remain fixed grid rows. Only the message region grows and scrolls. No content measurement state or animation scheduler was added.
- Reception uses the existing neutral Rune orb asset, Rune speaker label and a quiet message bubble. The non-persistence disclosure is separate, lower-priority copy.
- Rune and guest bubbles use existing Login Gate surface tokens. Send is a restrained glass control. The existing error copy is split into speaker and inline text with a 44px return action, without an alert card.
- Sending button presentation and the reply indicator derive from the existing `replying` state. The runtime exposes no separate transport-progress stages; no new stage is fabricated. Existing disabled, Enter and Shift+Enter behavior remains intact.
- Reduced-motion pulse runs only once. Explicit cycling through the dialog's existing focusable controls fixes WebKit skipping native buttons during Tab navigation.
- The panel layers its existing surface token to retain legibility when WebKit renders background blur differently. Login Gate geometry and backdrop source remain untouched. Header eyebrow has explicit line height and no wrapping.

## Conversation evidence

The new Phase 1.2 suite performs six guest/reply exchanges (12 messages) through the real guest adapter and transport with mocked SSE provider responses, then an empty-response failure. It captures initial, first exchange, third exchange, sixth exchange, replying and error states for both themes at 390×844, 430×932 and 1440×900, in Chromium and WebKit.

Representative measured panel heights, rounded to CSS pixels:

| Viewport | Initial | First exchange | Long conversation |
| --- | ---: | ---: | ---: |
| 390×844 | 490 | 542 | 608 |
| 430×932 | 541 | 542 | 671 |
| 1440×900 | 520 | 542 | 720 |

Per-run geometry JSON files accompany the screenshots. Header/font metrics can change the intrinsic first-exchange height by a few pixels across engines; the bounds remain enforced. The suite checks scrollable transcript, visible composer, zero horizontal/panel overflow, unchanged gate geometry, private-context exclusion, no transcript persistence, and all three runtime error channels.

Requested evidence examples (both browser variants are available):

- A: [390 empty](evidence/rune-guest-lounge-phase1.2/390-dark-empty-chromium.png)
- B: [390 conversation](evidence/rune-guest-lounge-phase1.2/390-dark-turn-6-chromium.png)
- C: [430 conversation](evidence/rune-guest-lounge-phase1.2/430-dark-turn-6-chromium.png)
- D: [Desktop empty](evidence/rune-guest-lounge-phase1.2/1440-dark-empty-chromium.png)
- E: [Desktop conversation](evidence/rune-guest-lounge-phase1.2/1440-dark-turn-6-chromium.png)
- F: [Inline error](evidence/rune-guest-lounge-phase1.2/390-dark-error-chromium.png)
- G: [Replying](evidence/rune-guest-lounge-phase1.2/390-dark-replying-chromium.png)
- H: [Light mode](evidence/rune-guest-lounge-phase1.2/430-light-turn-6-webkit.png)

## Regression setup findings

Before production edits, Guest Phase 1/1.1 returned 26 passed and six WebKit geometry failures: the baseline was captured during the gate's 320ms entrance transform. Waiting for its animation fixes that race without changing the 0.5px tolerance.

A subsequent probe isolated a separate 1px change to the existing Access String label's normal line height (15px before external font loading, 14px after). Geometry tests now wait for font network completion and `document.fonts.ready`. The existing close callback returns focus on the next animation frame; the unlock test waits for that focus return before filling the login input. These are test sequencing changes; no frozen login source was modified.

## Validation

- Guest Phase 1 + 1.1 + 1.2: **46/46 passed**, Chromium and WebKit.
- Login Gate production-assets + final-runtime suites: **35 passed, 1 existing WebKit clipboard-permission skip**.
- Login Gate rebuild/auth suite: **15/15 passed**, Chromium.
- Guest adapter unit tests: **6/6 passed**; API usage unit tests: **16/16 passed**.
- TypeScript and production build: **PASS**. Focused ESLint: **PASS**.
- `console.error`: **0**; `pageerror`: **0**; `unhandledrejection`: **0** in the focused Guest acceptance runs.
- Protected AuthGate, Login Gate CSS, ChatPage, DiaryPanel, credential files, provider runtime, raw transport and guest adapter hashes: **no drift**.
- All requested screenshot states captured; representative mobile/desktop, dark/light, empty/conversation/error/replying images visually inspected.

Final log files are retained in the Phase 1.2 evidence directory. This is a focused acceptance result, not a claim that the repository-wide E2E suite ran.

### Dev Server State Check

```text
5173 listener: present
PID: 75157
owner: user
GET /: 200
server state preserved: yes
serverWasRunningBeforeTask: true
serverStartedByThisTask: false
ownedServerPid: N/A
```

## Modified files

- `src/components/auth/GuestLounge.tsx`
- `src/components/auth/GuestLounge.css`
- `e2e/rune-guest-lounge-phase1.spec.ts` — settled geometry and close-focus test sequencing.
- `e2e/rune-guest-lounge-phase1.2-polish.spec.ts` — new conversation, responsive and keyboard acceptance.
- This report and `docs/reports/evidence/rune-guest-lounge-phase1.2/`.
- Existing Phase 1/1.1 and Login Gate suites refresh their screenshot evidence when executed.

## Limits and risks

Provider responses were mocked at the network boundary; no external paid provider was called. Mobile keyboard acceptance uses a 390×500 viewport, not a physical device keyboard. WebKit blur differs from Chromium; the more opaque panel provides readable foreground separation in both. Existing build chunk-size and mixed static/dynamic import warnings remain outside this visual scope.
