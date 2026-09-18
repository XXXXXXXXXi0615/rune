# Rune Guest Lounge Phase 1.2 Freeze

Status: **FROZEN**<br>
Effective phase: **Guest Lounge Phase 1.2 — Final Visual Closure**<br>
Canonical entry: `/login` pre-auth surface (no route)
Frozen on: **2026-09-18**

## Frozen ownership

- Mount and provider resolution owner: `src/pages/AuthGate.tsx`
- Presentation owner: `src/components/auth/GuestLounge.tsx`
- Presentation stylesheet: `src/components/auth/GuestLounge.css`
- Guest request builder and privacy lock: `src/features/auth/guestConversationAdapter.ts`
- Guest credential resolver: `src/ai/providerRuntime.ts` (`resolveProviderRequestConfig`,
  the single canonical credential-aware request-config resolver, returns the request config
  together with the credential resolved through the canonical `resolveProviderApiKey` /
  `CredentialStore` owner)
- Shared raw transport seam: `src/ai/client.ts` (`sendChatMessage`), `src/ai/types.ts`
  (`AIRequestConfig.persistUsage`)

Guest Lounge is a pre-auth presentation surface mounted by `AuthGate`. It is not a route,
does not own authentication state, and does not write canonical Conversation, Message,
memory, or usage data.

## Accepted presentation contract

- The trigger is a fixed 44px+ pill at the bottom-right safe area. It never overlaps the
  Enter Rune CTA and never changes `.rlg-panel` geometry when opened or closed.
- Opening the lounge does not move the Login Surface (card box identical before open and
  after close), does not add horizontal overflow, and does not scroll the document.
- The panel is a three-row grid (`auto minmax(0, 1fr) auto`): header, message region,
  and composer or terminal footer. During normal conversation the message region is the
  only scroll region and the composer remains visible, including at keyboard-equivalent
  heights. Terminal `error` / `unavailable` states remove the textarea and send control,
  collapse toward intrinsic height, and render the compact disabled footer
  `此刻無法傳送訊息`.
- The scrim and panel blur are presentation only; they never gate interaction or carry
  state.
- Rune's reception copy is the first conversational message with the canonical Rune
  avatar and speaker label. The separate low-priority disclosure
  `本次對話不會保存。` remains visible whenever the lounge is open.
- Close is a 44×44 control with a visible focus treatment; closing returns focus to the
  trigger. Escape closes. Focus is trapped inside the panel while open.
- The guest session is in-memory only: closing the lounge preserves it within the page
  session, reload clears it, and unlock clears it without migrating anything.
- Provider failure renders the calm copy `Rune 現在暫時不能在門外應答。` with the
  quiet 38px secondary action `← 返回登入`, never exposes a raw transport error, and
  does not retain the normal active-conversation minimum height.
- Reduced motion collapses the panel rise and typing pulse to 1ms.

## Frozen privacy boundary

Guest requests travel: Guest UI → `GuestConversationAdapter` → canonical raw transport
(`sendChatMessage`). The request contains only the locked guest system instruction plus
the guest session messages included in that request. It must not contain authenticated
Chat context, memory, tools, Calendar, Health, TIDEWATCH, TIDEQUEST, Journal, private
files, canonical conversation persistence, or provider usage persistence.

- `lockGuestRequestConfig` forces `systemPrompt`, clears `tools` and `telemetry`, and sets
  `persistUsage: false`. The transport honors the flag with a default-on semantic
  (`if (config.persistUsage === false) return;`).
- The adapter imports no private stores; its only imports are `@/ai/client`,
  `@/ai/providerRuntime`, and types.
- Guest provider resolution reads canonical provider configuration from the app store
  (`resolveChatProvider`) so the raw transport has a target. No private content is read.

## Validation baseline

- Frozen Login Gate regression: production assets 18/18, final runtime 17 pass + 1 WebKit
  clipboard-permission skip, canonical Auth/Exit Rune Chromium 15/15 — 50 passed + 1 skip.
- Guest Lounge focused suite: Chromium 10/10, WebKit 10/10.
- Guest Lounge provider availability (Phase 1.1): Chromium 6/6, WebKit 6/6.
- Guest Lounge Phase 1.2 visual/conversation closure: Chromium 7/7, WebKit 7/7.
- Combined Guest Phase 1 + 1.1 + 1.2: 46/46.
- Unit: `guestConversationAdapter.test.ts` 6/6, `apiUsage.test.ts` 16/16.
- TypeScript: pass. Focused ESLint: pass. Production build: pass.
- Runtime errors: console.error 0, pageerror 0, unhandledrejection 0.
- Evidence: `docs/reports/evidence/rune-guest-lounge-phase1/`
- Final closure evidence and SHA-256 index:
  `docs/reports/evidence/rune-guest-lounge-phase1.2-final/INDEX.md`.
- Final closure report:
  `docs/reports/rune-guest-lounge-phase1.2-final-visual-closure.md`.

Run before and after any approved reopen:

```bash
npx playwright test e2e/rune-guest-lounge-phase1.spec.ts --project=chromium --project=webkit
npx playwright test e2e/rune-guest-lounge-phase1.1-provider.spec.ts --project=chromium --project=webkit
npx playwright test e2e/rune-guest-lounge-phase1.2-polish.spec.ts --project=chromium --project=webkit
npx playwright test e2e/rune-login-production-assets.spec.ts --project=chromium --project=webkit
npx playwright test e2e/rune-login-final-runtime-closure.spec.ts --project=chromium --project=webkit
npx playwright test e2e/rune-login-gate-rebuild.spec.ts --project=chromium
npm run typecheck && npm run build
```

## Phase 1.1 — Provider Availability Closure

`resolveProviderRequestConfig` now returns the credential resolved by the canonical
`resolveProviderApiKey` seam with the request config, so a guest request is authenticated
whenever the credential owner can supply the secret. Nothing else changed: the guest
resolution chain, the privacy lock, the calm fallback, session lifetime, and the transport
seam are identical to Phase 1. The provider record created by the Settings editor persists
`apiKey: ''` with `hasCredential: true`, and browser sessions run the in-memory credential
adapter, so a reload still yields the calm fallback until durable storage is explicitly
opted into — reported in `docs/reports/rune-guest-lounge-phase1.1-provider-availability.md`.

## Phase 1.2 — Final Visual Closure

Phase 1.2 changes presentation only. Normal empty, 1-exchange, 3-exchange, and
6-exchange geometry is frozen at the accepted baseline. Desktop terminal height is
capped at 480px; mobile terminal height is capped at 54dvh. The normal composer,
replying state, scrolling, light/dark behavior, safe area, privacy boundary, and
ephemeral lifetime remain unchanged. Phase 1.2 does not authorize further polish and
does not imply a Phase 1.3.

## Reopen conditions

Reopen only when the user explicitly reopens this frozen surface, the canonical raw
transport contract changes, an accessibility defect is demonstrated, or a supported
viewport/browser regression is reproduced. Phase 1 additions are limited to what is listed
above: no Guest profile, account, persistence, history, media, voice, stickers, model
picker, quick replies, animations, CLAWD, Chat Perch, TIDEWATCH integration, Settings, or
route. Unrelated Auth, Home, Chat, or global theme work is not a reopen condition.
Additional visual polish alone is not authorized by this freeze.
