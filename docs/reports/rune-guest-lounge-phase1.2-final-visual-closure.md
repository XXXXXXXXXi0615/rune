# Rune Guest Lounge Phase 1.2 — Final Visual Closure

## Scope

This closure changes presentation only. Production edits are limited to
`GuestLounge.tsx` and `GuestLounge.css`. Provider selection, request transport,
credentials, guest privacy, persistence, authentication, and session lifetime are
unchanged.

## Final presentation

- `error` and `unavailable` reuse the existing `data-guest-status` state to remove
  the normal panel minimum height. Desktop caps the terminal panel at 480px; mobile
  caps it at 54dvh. Normal conversation maximum heights remain unchanged.
- Terminal states remove the textarea and send control from the DOM. A compact 40px
  disabled footer now communicates `此刻無法傳送訊息` without an input affordance.
- The return action is now `← 返回登入`, rendered as a 38px quiet glass button with
  the existing focus-visible treatment and native keyboard semantics.
- The reception message remains the same Rune message with the same avatar and copy.
  Its width is 88%, horizontal padding is reduced by 1px, border opacity is lowered,
  and the speaker-to-bubble gap is reduced from 8px to 5px.

## Geometry evidence

| Viewport | Empty | 1 exchange | 3 exchanges | 6 exchanges | Error |
| --- | ---: | ---: | ---: | ---: | ---: |
| 390×844 | 489.52 | 542.41 | 607.67 | 607.67 | 455.75 |
| 430×932 | 540.55 | 542.41 | 671.03 | 671.03 | 503.27 |
| 1440×900 | 520.00 | 542.41 | 720.00 | 720.00 | 480.00 |

The empty, 1-exchange, 3-exchange, and 6-exchange measurements exactly match the
accepted Phase 1.2 Chromium baseline. Only terminal error height collapses. The
message region remains the only scroll area and the normal composer remains visible.

## Requested captures

- `A-desktop-empty.png`
- `B-desktop-long-conversation.png`
- `C-desktop-error.png`
- `D-390-mobile-error.png`
- `E-390-mobile-conversation.png`

All five captures are in
`docs/reports/evidence/rune-guest-lounge-phase1.2-final/`.

## Validation

- Guest Lounge Phase 1 + Phase 1.1 + Phase 1.2, Chromium and WebKit: **46/46 passed**.
- TypeScript: **PASS**.
- Production build: **PASS**.
- Focused ESLint: **PASS**.
- `git diff --check`: **PASS**.
- Focused runtime acceptance: `console.error = 0`, `pageerror = 0`,
  `unhandledrejection = 0`.
- Responsive acceptance covers light/dark at 390×844, 430×932, and 1440×900;
  reduced motion and 390×500 keyboard-equivalent height also pass.

An earlier run executed production build concurrently with Playwright and produced
one external-font screenshot timeout plus one `ERR_CONNECTION_CLOSED`. The build
passed, and the browser suite was then rerun alone against the preserved server:
46/46 passed with neither error reproduced.

## Modified files

- `src/components/auth/GuestLounge.tsx`
- `src/components/auth/GuestLounge.css`
- `e2e/rune-guest-lounge-phase1.spec.ts`
- `e2e/rune-guest-lounge-phase1.1-provider.spec.ts`
- `e2e/rune-guest-lounge-phase1.2-polish.spec.ts`
- This report and the five final evidence captures.

## Dev Server State Check

```text
5173 listener: present
PID: 75157
owner: user
GET /: 200
server state preserved: yes
```

## Remaining issues and risks

No Phase 1.2 closure issue remains. The build still reports the repository's existing
large-chunk and ineffective-dynamic-import warnings. Provider replies remain mocked at
the network boundary for deterministic acceptance; no paid external provider was used.
