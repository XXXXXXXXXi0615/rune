# Rune Guest Lounge Phase 1 — Validation Closure

Date: 2026-09-17<br>
Route: none (pre-auth surface under `/login`)<br>
Status: PASS — FROZEN

Continuation of the interrupted Guest Lounge Phase 1 work. The implementation was already
complete; this closure finishes the remaining validation gates and does not change
production behavior.

## 1. Modified files

Guest Lounge implementation (previous agent, unchanged this round):

- `src/components/auth/GuestLounge.tsx` (new)
- `src/components/auth/GuestLounge.css` (new)
- `src/features/auth/guestConversationAdapter.ts` (new)
- `src/features/auth/guestConversationAdapter.test.ts` (new)
- `src/pages/AuthGate.tsx` (mount + guest provider resolution)
- `e2e/rune-guest-lounge-phase1.spec.ts` (new)

Shared transport seam (previous agent, unchanged this round):

- `src/ai/client.ts` (usage persistence flag honored)
- `src/ai/types.ts` (`AIRequestConfig.persistUsage`)
- `src/features/apiUsage/apiUsage.test.ts` (flag coverage)

Validation closure artifacts (this round):

- `docs/feature-freezes/rune-guest-lounge-phase1.md`
- `docs/reports/rune-guest-lounge-phase1-validation-closure.md`
- `docs/reports/evidence/rune-guest-lounge-phase1/` (18 screenshots + probe JSON)

No production file was modified in this closure. No Login Gate file was modified.

## 2. Ownership / data flow

- `AuthGate.tsx:202-205` resolves the guest provider with the canonical
  `resolveChatProvider(aiRoles, providers)` and passes `configured ? provider : null`.
- `AuthGate.tsx:481-489` mounts `<GuestLounge provider={guestProvider}
  onReturnToLogin={...} />` as a sibling of the composition inside the frozen gate root.
  The fallback focuses the returning input, the invitation input, or the enabled CTA.
- `GuestLounge.tsx` owns all guest session state locally (`open`, `messages`, `input`,
  `status`, refs). It writes no store, no localStorage, and no route.
- Guest conversation data flow: `GuestLounge` → `requestGuestReply()` →
  `resolveChatConfig(provider, guestInstruction)` → `lockGuestRequestConfig()` →
  `buildGuestConversationMessages()` → `sendChatMessage()` (canonical raw transport) →
  provider stream. The streamed reply returns to the component as local state.
- Guest session lifetime: in-memory; closed sheet preserves it in the page session,
  reload clears it, successful unlock clears the whole subtree without migration.

## 3. Shared transport seam change

- `src/ai/types.ts:77` — `AIRequestConfig.persistUsage?: boolean`.
- `src/ai/client.ts:43` — `record()` early-returns when `config.persistUsage === false`
  (default-on: every existing caller keeps persisting; only an explicit `false` opts out).
- `src/features/auth/guestConversationAdapter.ts:39-47` — `lockGuestRequestConfig()` forces
  `systemPrompt: GUEST_SYSTEM_INSTRUCTION`, `tools: undefined`, `telemetry: undefined`,
  `persistUsage: false`.
- Seam functions: `sendChatMessage` (`src/ai/client.ts`), `record` (internal to the same
  module), `resolveChatConfig` / `createProviderRequestConfig` (`src/ai/providerRuntime.ts`,
  pre-existing and unmodified, used read-only), `buildGuestConversationMessages`,
  `lockGuestRequestConfig`, `requestGuestReply`, `GUEST_SYSTEM_INSTRUCTION`
  (`src/features/auth/guestConversationAdapter.ts`).
- `persistUsage: false` has exactly one production consumer: the guest adapter. Grep over
  `src/` returns the flag only in `src/ai/types.ts`, `src/ai/client.ts`, the guest adapter,
  and `src/features/apiUsage/apiUsage.test.ts`.

## 4. Privacy boundary proof

Static:

- `guestConversationAdapter.ts` imports only `@/ai/client`, `@/ai/providerRuntime`, and
  types — no store imports, no memory, no tools, no context builders.
- `GuestLounge.tsx` imports only React, the adapter, a type, and its stylesheet.
- Reverse dependencies: only `GuestLounge` imports the adapter; only `AuthGate` imports
  `GuestLounge`. There is no second owner and no route.
- The request message array is built exclusively by `buildGuestConversationMessages()`:
  one locked system instruction plus the guest session turns inside the configured limit.

Runtime (focused suite + probe, Chromium):

- Captured `/chat/completions` payload keys: `model`, `messages`, `temperature`,
  `max_tokens`, `top_p`, `stream`, `stream_options` — no `tools` key.
- Message roles exactly `['system', 'user']`; model equals the configured guest model.
- Private sentinels (`PRIVATE_PROFILE_SENTINEL`, `PRIVATE_MEMORY_SENTINEL`,
  `PRIVATE_CHAT_SENTINEL`, `PRIVATE_SYSTEM_PROMPT_SENTINEL`) are absent from the payload.
- `lunartide_data` keeps `conversations` 1, `messages` 1, and contains no guest text after
  send, after reload, and after unlock.
- No localStorage key matches `/guest/i`; no guest history is written.
- IndexedDB after unlock contains only `lunartide-life-ledger-v1`; the
  `lunartide-provider-usage` database is never created, so no provider usage persistence
  came from the guest request.
- Reload clears the guest session (0 messages, disclosure still visible).
- Unlock removes the trigger and does not migrate guest messages into Chat.

Explicitly absent from the guest request: authenticated Chat context, memory, tools,
Calendar, Health, TIDEWATCH, TIDEQUEST, Journal, private files, canonical conversation
persistence, and provider usage persistence.

## 5. Chromium result

- `e2e/rune-guest-lounge-phase1.spec.ts`: 10/10 pass.
- Frozen `rune-login-production-assets.spec.ts`: 9/9 pass.
- Frozen `rune-login-final-runtime-closure.spec.ts`: 9/9 pass.
- Frozen `rune-login-gate-rebuild.spec.ts`: 15/15 pass.

## 6. WebKit result

- `e2e/rune-guest-lounge-phase1.spec.ts`: 10/10 pass.
- Frozen `rune-login-production-assets.spec.ts`: 9/9 pass.
- Frozen `rune-login-final-runtime-closure.spec.ts`: 8/9 pass + 1 skip (Playwright WebKit
  does not expose `clipboard-write`; the OS clipboard paste is covered in Chromium).

## 7. Frozen Login Gate regression result

PASS with no failures, so no A/B/C/D classification was required and no production change
was made.

Coverage confirmed: First Run, First Run success (issuance, Copy, Regenerate), Returning
idle, Returning focused, invalid Access String, verifying state, empty CTA disabled,
show/hide, keyboard Enter submit, clipboard paste (Chromium), safe-area geometry,
390×844, 430×932, 1440×900, keyboard-equivalent viewports, and the canonical Settings
Exit Rune flow (row placement + divider, cancel, confirm → `/login` with data preserved).

Guest Lounge did not change login card geometry, CTA position, focus behavior, validation
slot behavior, auth state, safe-area handling, or scroll behavior. The frozen spec files
were not edited.

## 8. TypeScript result

`npm run typecheck` (`tsc -b --pretty false`): exit 0, no diagnostics.

## 9. ESLint result

Focused ESLint over the seven Guest Lounge phase files (`GuestLounge.tsx`,
`guestConversationAdapter.ts`, `guestConversationAdapter.test.ts`, `AuthGate.tsx`,
`ai/client.ts`, `ai/types.ts`, `rune-guest-lounge-phase1.spec.ts`): exit 0, no findings.
No unrelated warnings were touched.

## 10. Production build result

`npm run build` (`tsc -b && vite build`): exit 0. Pre-existing warnings were recorded and
not addressed: `INEFFECTIVE_DYNAMIC_IMPORT` for `src/store/assets.ts` and
`src/store/useCharacterStore.ts`, and chunks above 500 kB (`index` 1,398.48 kB,
`ChatEntry` 555.97 kB, `DicePreview3D` 540.81 kB).

## 11. Runtime error counts

- Focused Guest Lounge suite (both engines, every test): console.error 0, pageerror 0,
  unhandledrejection 0.
- Probe lifecycle — open, send success, provider failure, close, reopen, reload,
  keyboard-equivalent height, unlock transition: console.error 0, pageerror 0,
  unhandledrejection 0.
- Probe visual contract: trigger/CTA overlap false; card box identical before open, after
  open, and after close; horizontal overflow 0; composer visible in panel and viewport
  (including 390×500); message region the only user scroll region; document not
  scrollable; scrim `blur(3px)` presentation; close control 44×44; disclosure
  `本次對話不會保存。` visible; focus returns to `guest-lounge-trigger` after close.

## 12. Evidence screenshot paths

`docs/reports/evidence/rune-guest-lounge-phase1/`

- Trigger + lounge: `390x844-dark-trigger-{chromium,webkit}.png`,
  `1440x900-dark-trigger-{chromium,webkit}.png`
- Lounge open: `390x844-{dark,light}-{chromium,webkit}.png`,
  `430x932-{dark,light}-{chromium,webkit}.png`,
  `1440x900-{dark,light}-{chromium,webkit}.png`
- Ephemeral reply: `390x844-ephemeral-reply-{chromium,webkit}.png`
- Probe: `runtime-visual-probe.json`

All six frame/theme combinations in both engines, plus the Chromium trigger and
ephemeral-reply captures that were missing from the interrupted run.

## 13. Remaining issues

- This session cannot render images inline, so the screenshots were verified by dimension
  and by programmatic geometry/contract probes rather than by eye. Human review of the
  evidence PNGs is recommended.
- The guest session intentionally survives closing the sheet within the page session and
  is cleared by reload; this is the accepted Phase 1 behavior, not a defect.
- The probe's scroll-region scanner also lists the visually hidden `guest-lounge-sr-only`
  label (1px clipped, not user-scrollable). The meaningful result stands: no document
  scroll and no nested scroller besides the message region.

## 14. Risks

- The worktree is uncommitted; this closure staged and committed nothing.
- Guest Lounge presentation consumes the frozen Login Gate token namespace (`--rlg-*`).
  A future Login Gate reopen that renames those tokens would break guest styling.
- `persistUsage` is a shared transport contract: a future caller setting `false` would
  suppress provider usage persistence for that request by design.
- Guest provider resolution reads canonical provider configuration from the app store.
  This is configuration, not private content, but it couples guest availability to the
  configured chat provider until a later phase decides otherwise.

## 15. Git status

- No `git add`, `git clean`, `git reset`, `git restore`, or `git checkout` was run.
- Guest/Login-Gate-phase files appear as untracked (`??`) because the repository baseline
  predates them; the wider worktree dirty state is pre-existing and untouched.
- Untracked from this round: `docs/feature-freezes/rune-guest-lounge-phase1.md`,
  `docs/reports/rune-guest-lounge-phase1-validation-closure.md`,
  `docs/reports/evidence/rune-guest-lounge-phase1/`.

## Dev Server State Check

```
5173 listener: present (before task, throughout, after task)
PID: 75157
owner: user (existing session; not started by this task)
GET /: 200
server state preserved: yes
```

No process was started, restarted, or killed by this task.

## Final verdict

Rune Guest Lounge Phase 1 = **FROZEN**. The frozen Rune Login Gate regression is green,
the privacy boundary is intact, and every validation gate passes.
