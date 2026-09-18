# Rune Guest Lounge Phase 1.1 — Provider Availability Closure

Date: 2026-09-17<br>
Route: none (pre-auth surface under `/login`)<br>
Status: PASS — closure implemented, Phase 1 + Login Gate regressions green

The guest surface, the ephemeral runtime, the privacy boundary, and the transport
isolation are unchanged. This phase repairs the provider-credential seam that feeds the
guest request and proves the result against a profile created through the real Settings UI.

## 1. Root cause

**Primary — H: PROVIDER_RUNTIME_FAILURE.** The canonical credential resolver computed the
provider secret and then discarded it, so every guest request was built with an empty
`apiKey` and was rejected by the transport guard before any HTTP call left the browser.

Evidence (`docs/reports/evidence/rune-guest-lounge-phase1.1/provider-audit-pre-fix.json`,
profile created through the real provider editor, key present in the session credential
store):

```
chain:  configured: true, reason: 'ready'
        resolvedProviderApiKey: "<19 chars>"              ← credential IS readable
        configApiKeyAfterResolveChatConfig: "(empty)"    ← discarded
guest:  requestsSent: 0, replyCount: 0, status: "error",
        unavailableShown: 1 → "Rune 現在暫時不能在門外應答。"
```

The throw site is the transport guard (`src/ai/client.ts`, `if (!config.apiKey &&
!config.apiKeyOptional) throw new Error('請先在設定中設定 API Key')`), reached because
`resolveChatConfig` returned `createProviderRequestConfig(...)` unchanged while its only
caller — the guest adapter — awaited a config that was supposed to carry the credential.

**Conditional — E: CREDENTIAL_UNAVAILABLE_PRE_AUTH.** In a browser the credential store
resolves to `MemoryCredentialStore`, and the persisted provider record is sanitized to
`apiKey: ''` on every state write. After any reload the secret no longer exists anywhere
reachable, so no pre-auth request can be authenticated. Scenario B of the same evidence
file: `resolvedProviderApiKey: "(empty)"`, guest stays on the calm fallback.

Classification of the other candidates with evidence: not A/B/C/D — the provider record
exists, is enabled, is selected by the canonical contract, and `resolveChatProvider`
returns `configured: true / reason: 'ready'` with a non-null provider. Not F — the raw
transport supports the provider type. Not G — no network call is attempted at all.

## 2. Exact provider ownership chain

```
useAppStore.state.providers                    src/store/useAppStore.ts
  └─ persist partialize strips apiKey → ''      src/store/useAppStore.ts:3681-3696
AuthGate guestProvider                          src/pages/AuthGate.tsx:202-205
  └─ resolveChatProvider(aiRoles, providers)    src/ai/providerRuntime.ts:72-77
       └─ resolveRoleProvider → resolveActiveProvider   src/ai/providerRuntime.ts:33-70
GuestLounge prop                                src/components/auth/GuestLounge.tsx
  └─ requestGuestReply                          src/features/auth/guestConversationAdapter.ts:49
       └─ resolveChatConfig                     src/ai/providerRuntime.ts:104
            └─ createProviderRequestConfig      src/ai/providerRuntime.ts:86
       └─ lockGuestRequestConfig                src/features/auth/guestConversationAdapter.ts:39
       └─ buildGuestConversationMessages        src/features/auth/guestConversationAdapter.ts:23
       └─ sendChatMessage (raw transport)       src/ai/client.ts:31
            └─ streamOpenAI / streamAnthropic / streamGoogle
```

Policy point: `resolveActiveProvider` selects `isDefault && enabled`, else the first
enabled provider; `resolveRoleProvider` honours `aiRoles.chat` when it points at an enabled
provider. No second ordering was introduced. A provider with `enabled: false` yields
`provider: null` and the calm fallback.

## 3. Exact credential ownership chain

```
CredentialStore (canonical owner)              src/ai/credentialStore.ts
  ├─ NativeCredentialStore      (Capacitor SecureStorage)
  ├─ WebFallbackCredentialStore (localStorage `lunartide_credential_web_fallback`,
  │                              gated by `lunartide_credential_web_fallback_ack`)
  └─ MemoryCredentialStore      (globalThis.__lunartide_cred_memory)  ← default in browsers
Writers:
  ProviderConfigWindow.handleSave → setCredential(id, key); provider.apiKey = '';
                                    hasCredential = true       src/components/settings/ProviderConfigWindow.tsx:159-200
  credentialMigration phase A/B → legacy plaintext key → store → strip src/ai/credentialMigration.ts
Readers:
  ProviderConfigWindow.resolveKeyForRuntime   (connection test)
  providerRuntime.resolveProviderApiKey       (the seam the guest path already used)
  reconcileCredential                         (storage-state labels; UI + tests)
Acknowledgement:
  acknowledgeWebFallback() has no production caller → browsers always run memory mode
```

Provider ids are stable per record; `credentialId` (`provider:<id>`) is the lookup key and
is persisted alongside `hasCredential`.

## 4. Whether pre-auth credential access already existed

Yes. `getCredentialStore()` and `resolveProviderApiKey()` are module-level APIs with no
auth or unlock gate, and the guest path already invoked them through `resolveChatConfig`.
No new seam, store, persistence, or credential copy was created; the resolution result was
simply wired into the returned config. `acknowledgeWebFallback()` (durable browser
storage) remains unused and was deliberately not enabled — that is a product decision about
persisting secrets in localStorage, not a validation-closure step.

## 5. Modified files

- `src/ai/providerRuntime.ts` — `resolveChatConfig` now returns the resolved credential with
  the request config (`{ ...createProviderRequestConfig(...), apiKey }`); removed a
  pre-existing unused `PROVIDER_DEFAULTS` import.
- `src/features/auth/guestConversationAdapter.test.ts` — "provider availability resolver"
  block: 3 new unit cases (stored credential reaches the config, inline key precedence and
  no invented credential, resolver surface contains no tools/telemetry).
- `e2e/rune-guest-lounge-phase1.1-provider.spec.ts` — 6 provider-availability cases.

No Guest UI, Guest session lifetime, transport isolation, persistence contract, Login Gate,
First Run, Access String, or AuthGate change.

## 6. Privacy impact

None — the privacy contract is unchanged and re-verified:

- Request payload roles stay exactly `['system', 'user']`; `tools` absent; sentinels
  (`PRIVATE_*`) absent; `persistUsage: false`, `telemetry: undefined` still forced by
  `lockGuestRequestConfig`.
- `lunartide_data` keeps `conversations: 1` / `messages: 1`; guest text is absent from
  storage; no `/guest/i` localStorage key; no `lunartide-provider-usage` database.
- The credential is consumed in memory for the request headers only. Evidence JSONs record
  presence booleans and character counts, never the secret; the probe asserts the key never
  appears in `localStorage`.
- Reload clears the guest session; unlock destroys it without migration.

## 7. Chromium

- New `rune-guest-lounge-phase1.1-provider.spec.ts`: 6/6.
- Phase 1 regression `rune-guest-lounge-phase1.spec.ts`: 10/10.
- Frozen Login Gate: production assets 9/9, final runtime 9/9, gate-rebuild 15/15.

## 8. WebKit

- New provider spec: 6/6.
- Phase 1 regression: 10/10.
- Frozen Login Gate: production assets 9/9, final runtime 8/9 pass + 1 skip (WebKit has no
  `clipboard-write` automation permission).

## 9. TypeScript

`npm run typecheck` exit 0. Focused ESLint over the three touched files: clean.

## 10. Build

`npm run build` exit 0. Pre-existing `INEFFECTIVE_DYNAMIC_IMPORT` and >500 kB chunk
warnings unchanged.

## 11. Runtime errors

console.error 0, pageerror 0, unhandledrejection 0 across the new provider spec (both
engines), the Phase 1 suite, and the audit probe lifecycle (provider save → guest request →
reload → unlock).

## 12. Real-profile proof

A profile was built by driving the actual Settings provider editor (新增提供者 → name, API
key, model → save) and then locking through the canonical 退出 Rune flow, so the observation
matches what the app itself persists:

- Pre-fix: `apiKey: ''`, `hasCredential: true`, credential only in the session store →
  guest request never left the browser → calm fallback.
- Post-fix: same profile → `configApiKey "<19 chars>"`, exactly one request to
  `https://api.openai.com/v1/chat/completions` with `Authorization: Bearer` present and the
  configured model, reply rendered in the lounge, status back to `idle`.
- After a reload: credential gone from the session store → the guest stays calm with no
  request. Honest failure, no fake success.

Full unit suite: 165 files / 1574 tests pass.

## 13. Remaining risks

- **Same gap on the authenticated path (out of scope, evidenced).** `createProviderRequestConfig`
  reads only the sanitized inline `provider.apiKey`, so authenticated chat also sends no
  request under the same profile (`authenticatedPath.apiKey: "(empty)"`, 0 requests in the
  chat probe). This phase deliberately did not touch that runtime; it needs its own approved
  change (async credential injection across ChatPage, requestAdapter, DiaryPanel, FocusChat,
  tideRailAdjudication).
- **Credential durability.** Until a deliberate opt-in enables durable browser storage, a
  reload drops the key and the guest lounge returns to the calm fallback. Workaround for the
  real environment: unlock once, re-enter the provider key in Settings, then use the lounge
  for the rest of the session.
- **Fallback policy preserved.** Provider offline, missing credential, timeout, HTTP failure,
  and malformed responses all still land on `Rune 現在暫時不能在門外應答。` with no raw error.
- Evidence screenshots and JSONs record no secret values.
