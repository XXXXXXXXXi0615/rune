# Rune AI Credential Runtime Freeze

Status: **FROZEN**  
Effective phase: **AI Credential Runtime Closure**  
Canonical entry: every production AI request path

## Frozen ownership

- Canonical credential-aware request-config resolver:
  `resolveProviderRequestConfig(provider, systemPrompt)` in `src/ai/providerRuntime.ts`.
  It resolves the secret through `resolveProviderApiKey` (`src/ai/providerRuntime.ts`) and
  returns the request config with `apiKey` populated.
- Canonical credential owner: `src/ai/credentialStore.ts`. No other store, cache, or copy of
  a provider secret may exist.
- Credential-free config builder `createProviderRequestConfig` is module-private; it exists
  only as the resolver's implementation detail.
- Provider record contract: persisted `providers[].apiKey` stays `''` (store `partialize`);
  records may carry `credentialId`, `hasCredential`, `credentialUpdatedAt` only.
- Migrated request paths (all build their config through the resolver):
  `src/pages/ChatPage.tsx`, `src/components/memory/DiaryPanel.tsx`,
  `src/components/ClawdWorkspace/FocusChat.tsx`,
  `src/features/tiderail/tideRailAdjudication.ts`, `src/ai/requestAdapter.ts`
  (`buildChatRequest` is async), and `src/features/auth/guestConversationAdapter.ts`.

## Frozen credential policy

| Environment | Adapter | Persistence |
|---|---|---|
| Web (default) | `MemoryCredentialStore` | session-only; reload requires re-entry |
| Native (Capacitor SecureStorage) | `NativeCredentialStore` | persistent secure path |
| Web fallback | `WebFallbackCredentialStore` | **exists but NOT enabled** |

- The web fallback requires `acknowledgeWebFallback()`; that function has **no production
  caller** and no acknowledgement UI. Enabling it is deferred — see
  `docs/backlog/web-persistent-credential-opt-in.md`.
- Rune's primary product direction is mobile/native, so browser session-only credentials are
  the accepted policy; browser reload convenience is never a reason to downgrade credential
  protection automatically.
- Missing-credential behavior is frozen: authenticated surfaces raise the explicit
  credential-required state, the guest lounge keeps its calm fallback. No fake success, no
  retry loop, no raw provider error, no fallback to another provider's private context.

## Accepted request contract

- Every AI request config is produced by the canonical resolver; features must not call
  `getCredentialStore()`/`getCredential()` or assemble their own credential fields.
- The guest privacy contract is unchanged: locked guest system instruction, tools and
  telemetry cleared, `persistUsage: false`, no memory or authenticated context, no canonical
  Conversation/Message writes.

## Validation baseline

- `e2e/ai-credential-runtime-closure.spec.ts`: Chromium 4/4, WebKit 4/4.
- Guest Lounge Phase 1 + 1.1: 32/32 across Chromium and WebKit.
- Frozen Login Gate regression: 50 passed + 1 WebKit clipboard skip.
- Authenticated chat baseline (`npm run test:chat:baseline`): 210 passed / 4 skipped.
- Vitest: 165 files / 1575 tests pass. TypeScript: pass. Focused ESLint: pass on the
  resolver and migrated callers. Production build: pass.
- Runtime errors: console.error 0, pageerror 0, unhandledrejection 0.
- Evidence: `docs/reports/evidence/ai-credential-runtime-closure/`

Run before and after any approved reopen:

```bash
npx playwright test e2e/ai-credential-runtime-closure.spec.ts --project=chromium --project=webkit
npx playwright test e2e/rune-guest-lounge-phase1.spec.ts e2e/rune-guest-lounge-phase1.1-provider.spec.ts --project=chromium --project=webkit
npm run test:chat:baseline
npm run typecheck && npm run build
```

## Reopen conditions

Reopen only when the user explicitly requests a credential-policy or provider-resolution
change, the canonical credential owner is formally replaced, a supported platform exposes a
secure persistent browser credential path, or an accessibility/security defect is
demonstrated. Unrelated Chat, Guest, Home, or theme work is not a reopen condition, and the
deferred web opt-in stays deferred until a browser-first deployment is actually planned.
