# Rune Guest Lounge Phase 1.2 Final Evidence Index

Status: **FROZEN**<br>
Closure: **Rune Guest Lounge Phase 1.2 Visual Closure = PASS**<br>
Captured: **2026-09-18**

## Requested captures

| ID | Evidence | Acceptance purpose | SHA-256 |
| --- | --- | --- | --- |
| A | `A-desktop-empty.png` | 1440×900 empty reception panel | `38178fa12ca71676bd7fd1c720a0c4b14c3f71ef1e147d2679e8c4ddec2ad465` |
| B | `B-desktop-long-conversation.png` | 1440×900 six-exchange conversation and scroll region | `36e189c472983753e95a03b6d01e700ce2a078fc94be7e81dcaf4a1dd3353e59` |
| C | `C-desktop-error.png` | 1440×900 compact terminal error state | `44d458985278b4d9d07724fa4b79c5329b9cb93721151f92aae2fa0b14ea4bba` |
| D | `D-390-mobile-error.png` | 390×844 compact mobile terminal state and safe area | `7977f6a6efc968e05958d841e2c12f2bceec2ca880dd1a7ae977f134a5da3dd5` |
| E | `E-390-mobile-conversation.png` | 390×844 six-exchange mobile conversation | `b8d665bd421835a73e1495cfac74907de67043148d0cf2e5025855ce7ab62990` |

## Geometry records

The 12 JSON records cover 390×844, 430×932, and 1440×900 in light/dark for
Chromium and WebKit. Files for the same viewport intentionally share geometry hashes:

| Viewport | Files | SHA-256 |
| --- | ---: | --- |
| 390×844 | 4 | `c938302ec5095d5056a12f0d2bb09b046840c58f561cd9ce14a613c6055603d2` |
| 430×932 | 4 | `70f005e2d37d806d4b654247b36bd452a4ced33930ecea48be76a7190812d7ed` |
| 1440×900 | 4 | `2358e14e80bd242a40711f4e09f4a08d9fa113ad98482f11815f5533609c041d` |

## Validation provenance

- Generator: `e2e/rune-guest-lounge-phase1.2-polish.spec.ts`
- Mock boundary: real guest adapter and transport with deterministic mocked SSE replies
- Evidence regeneration: Chromium 7/7 passed
- Combined Phase 1 + 1.1 + 1.2 closure: Chromium/WebKit 46/46 passed
- Runtime acceptance: `console.error = 0`, `pageerror = 0`,
  `unhandledrejection = 0`
- Closure report: `docs/reports/rune-guest-lounge-phase1.2-final-visual-closure.md`

`.DS_Store` is incidental filesystem metadata and is excluded from this evidence index.
