# Rune AI Credential Runtime Closure

Date: 2026-09-17  
Status: PASS — canonical credential-aware resolver adopted, authenticated chat proved, guest + login gate regressions green

Closes the gap Phase 1.1 identified: every production AI request path now builds its
`AIRequestConfig` through one canonical resolver that reads the canonical CredentialStore.
No new credential owner, no new persistence, no change to the guest contract.

## 1. Request-path ownership matrix

| Path | Provider owner | Credential resolver | Config builder | Transport | Class | Action |
|---|---|---|---|---|---|---|
| Chat (private/group) `ChatPage.tsx:1026` | `resolveChatProvider(aiRoles, providers)` | **migrated** → `resolveProviderRequestConfig` | canonical resolver | `streamWithMcpTools` → `sendChatMessage` | B | migrated |
| Forum Luna reply `DiaryPanel.tsx:550` | `resolveActiveProvider(providers)` | **migrated** | canonical resolver | `sendChatMessage` | B | migrated |
| Tidebound focus chat `FocusChat.tsx:98` | `resolveActiveProvider(providers)` | **migrated** | canonical resolver | `sendChatMessage` | B | migrated |
| TideRail adjudication `tideRailAdjudication.ts:168` | `resolveActiveProvider(providers)` | **migrated** | canonical resolver | `sendChatMessage` | B | migrated |
| Guest lounge `guestConversationAdapter.ts:54` | `resolveChatProvider` (AuthGate) | already canonical (Phase 1.1) | canonical resolver | `sendChatMessage` | A | unchanged |
| `requestAdapter.ts:116` `buildChatRequest` | `resolveChatProvider` | **migrated** (now async) | canonical resolver | none (returns config) | D | migrated for consistency |
| `useAppStore.ts:2953` `sendAiMessage` | legacy `state.aiConfig` | none | ad-hoc object | `sendChatMessage` | D | left as-is |
| `AiConfigDrawer.tsx:66` connection test | component-local key | none | ad-hoc object | `sendChatMessage` | D | left as-is |
| `SleepImportSheet.tsx:103` AI parse | legacy `aiConfig` | none | ad-hoc object | `sendChatMessage` | C/D | left as-is |
| Provider editor connection test `ProviderConfigWindow.tsx:62` | user-typed key | `getCredentialStore` (owner UI) | n/a | `fetch` probe | C | unchanged |

Evidence for the D classifications: `sendAiMessage` has no callers; `AiConfigDrawer` has no
mount point; `SleepImportSheet` is mounted but gated on `aiConfig.apiKey`, which no code
writes any more (`aiConfig.apiKey` appears only as a reader), so its AI branch is
unreachable; `loadProviders`/`saveProviders` in `config/providers.ts` are also unused.

## 2. Canonical credential resolver

```
ProviderConfig
      ↓
resolveProviderApiKey(provider)      src/ai/providerRuntime.ts:24   canonical CredentialStore
      ↓
resolveProviderRequestConfig(...)    src/ai/providerRuntime.ts:110  ← single canonical seam
      ↓
AIRequestConfig.apiKey = resolved credential
```

`createProviderRequestConfig` lost its `export`: it is now an implementation detail of the
resolver, so no feature can build a credential-free request config. Every caller migrated in
this phase awaits the async resolver.

## 3. Modified callers

- `src/pages/ChatPage.tsx` — import + `await resolveProviderRequestConfig(runtimeProvider, systemPrompt)`.
- `src/components/memory/DiaryPanel.tsx` — import + `await resolveProviderRequestConfig(provider, systemPrompt)`.
- `src/components/ClawdWorkspace/FocusChat.tsx` — import + `await resolveProviderRequestConfig(activeProvider, systemPrompt)`.
- `src/features/tiderail/tideRailAdjudication.ts` — import + `await resolveProviderRequestConfig(provider, …)`.
- `src/ai/requestAdapter.ts` — `buildChatRequest` is async and awaits the resolver; removed three pre-existing unused symbols so its focused lint passes.
- `src/features/auth/guestConversationAdapter.ts` — switched to the renamed resolver (no behavior change).
- `src/ai/providerRuntime.ts` — resolver renamed, builder made module-private.
- Tests: `src/features/auth/guestConversationAdapter.test.ts` (rename), `src/ai/credentialStore.test.ts` (+ web opt-in gating case), `e2e/ai-credential-runtime-closure.spec.ts` (new).

Two test-side hardenings, both unrelated to credential behavior:

- `e2e/chat-local-send.spec.ts` — added the canonical `#pre-splash` boot gate. Without
  it the composer's `fill()` is silently swallowed while `#root[inert]` is up (proved with a
  controlled probe: no gate → `rootInert: true`, empty value, no send button; gate → value
  sticks, send button appears). This path is local mode with no provider and never calls the
  credential code.
- `e2e/rune-guest-lounge-phase1.spec.ts` — the two "card box identical" assertions now use a
  0.5px tolerance (`expectSameBox`). An exact `toEqual` on layout floats produced one
  parallel-load WebKit flake (414.96871948 vs 414.96875). The frozen contract ("opening the
  lounge does not move the Login Surface") is unchanged; only sub-pixel rounding noise is
  absorbed, matching the tolerance style already used by the login-gate suite.

## 4. Credential persistence remains canonical

- `useAppStore` persist `partialize` still forces `providers[].apiKey = ''`
  (`src/store/useAppStore.ts:3681-3696`); provider records keep `credentialId`,
  `hasCredential`, `credentialUpdatedAt` only.
- The secret is read exclusively through `CredentialStore` (`src/ai/credentialStore.ts`).
- E2E assertions after a successful authenticated request: `persisted.providers[0].apiKey`
  is `''`, `hasCredential` is `true`, `credentialId` unchanged, and `JSON.stringify(localStorage)`
  never contains the secret.

## 5. Authenticated Chat proof

`e2e/ai-credential-runtime-closure.spec.ts` (Chromium + WebKit):

- Provider persisted with `apiKey: ''`, `hasCredential: true`, valid `credentialId`, secret
  present in the canonical store → send → exactly 1 request to
  `https://api.example.test/v1/chat/completions`, `Authorization: Bearer` present and
  carrying the key, configured model, assistant reply rendered.
- Missing credential → explicit credential-required toast (`請先在設定中設定 API Key`), no
  assistant bubble, 0 requests. No fake success, no retry loop, no raw provider error.
- Keyless provider (Ollama shape, `apiKeyOptional`) → request sent with **no** Authorization
  header (regression guard for keyless providers).
- Reload (memory-mode) → the secret is gone; the chat fails safely with the same explicit
  state and 0 requests, and the secret never reaches storage.

## 6. Guest regression

- `rune-guest-lounge-phase1.spec.ts` + `rune-guest-lounge-phase1.1-provider.spec.ts`: 32/32
  across Chromium and WebKit.
- Invariants re-verified: reply works while the credential is readable, `tools` absent,
  memory absent, authenticated context absent, `persistUsage: false`, no canonical
  Conversation/Message writes, reload clears the guest session, unlock destroys it.
- The guest resolver rename is the only guest-facing change; the privacy lock and the calm
  fallback are untouched.

## 7. Web memory-mode behavior

The browser default remains `MemoryCredentialStore` (`persistence: 'memory'`,
`survivesReload: false`). Secrets entered in Settings live only for the page session; after
a reload every request path (chat, guest, diary, focus, tiderail) fails safely with the
credential-required state. This is the documented, unfaked behavior — verified by the reload
cases in both the new spec and Phase 1.1's audit.

## 8. WebFallback availability

`WebFallbackCredentialStore` (`persistence: 'persistent-insecure'`, localStorage key
`lunartide_credential_web_fallback`) still exists and still requires the explicit
`acknowledgeWebFallback()` acknowledgement. `acknowledgeWebFallback()` has **no production
caller** — no UI, no automatic path — so no browser profile can silently persist a secret.
Now covered by a unit case: without acknowledgement the secret vanishes across a simulated
reload and `lunartide_credential_web_fallback` is never written; with acknowledgement it
survives.

## 9. Security impact and the opt-in proposal

- Unchanged: canonical owner, sanitized persistence, no plaintext auto-persist, no second
  store, no guest credential, no memory/tools exposure.
- Improved: the credential now reaches requests that previously could not authenticate, and
  the failure surface is an explicit credential-required state instead of a silent keyless
  request.
- Risk accepted by design: a guest request now carries the provider credential in memory for
  the duration of the request (as the authenticated paths already did); it is never written,
  logged, or echoed to the UI.

**Proposal (not implemented — decision required).** Minimal opt-in surface in the provider
editor, under the API Key field:

```
保存方式
 ● 僅本次工作階段    關閉或重新載入後需要重新輸入
 ○ 記住在此瀏覽器    金鑰會以本機明文儲存，安全性較低
```

Selecting the second option would be the only caller of `acknowledgeWebFallback()` (then
`resetCredentialStore()`), routing secrets to the existing `WebFallbackCredentialStore`;
selecting the first would call `disableWebFallback()`. Security impact: the key would live
in `localStorage` readable by any script on the origin (XSS-equivalent exposure), and the
existing `ProviderCenter` label already distinguishes `已保存（本機）`. Native Capacitor
builds keep the secure `NativeCredentialStore` and are unaffected.

## 10. Chromium

- `ai-credential-runtime-closure.spec.ts`: 4/4.
- Guest Lounge Phase 1 + 1.1: 16/16.
- Frozen Login Gate: production assets 9/9, final runtime 9/9, gate-rebuild 15/15.
- Chat baseline (14 specs, with WebKit): 210 passed / 4 skipped.

## 11. WebKit

- `ai-credential-runtime-closure.spec.ts`: 4/4.
- Guest Lounge Phase 1 + 1.1: 16/16.
- Frozen Login Gate: production assets 9/9, final runtime 8/9 + 1 clipboard skip.

## 12. Vitest

`npm run test`: 165 files / 1575 tests pass (includes the new web opt-in gating case and the
3 provider-availability resolver cases).

## 13. Build

`npm run build` exit 0. Pre-existing `INEFFECTIVE_DYNAMIC_IMPORT` and >500 kB chunk warnings
unchanged.

## 14. Runtime errors

console.error 0, pageerror 0, unhandledrejection 0 in the new suite (both engines) and across
the guest, login gate, and chat baseline regressions.

## 15. Remaining decision

Whether to expose the persistent Web credential opt-in described in §9. Until then, browser
sessions keep session-only credentials, and the guest lounge plus authenticated chat work
whenever the credential is readable in the session.

## Notes

- Focused ESLint passes for `providerRuntime.ts`, `requestAdapter.ts`,
  `guestConversationAdapter.ts`, `FocusChat.tsx`, `tideRailAdjudication.ts`, the two touched
  test files' added lines, and the new spec. `ChatPage.tsx`, `DiaryPanel.tsx`, and
  `credentialStore.test.ts` carry pre-existing lint debt (react-hooks rules, unused legacy
  symbols, `(globalThis as any)` fixtures) whose reported lines do not intersect this
  phase's edits.
- Evidence: `docs/reports/evidence/ai-credential-runtime-closure/` (Chromium + WebKit
  screenshots of the authenticated credential reply).
- No git staging or commit was performed; the worktree baseline is otherwise untouched.
