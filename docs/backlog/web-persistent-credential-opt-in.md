# Web Persistent Credential Opt-In — DEFERRED

Status: **DEFERRED** (decision recorded 2026-09-17)  
Related freeze: [Rune AI Credential Runtime](../feature-freezes/rune-ai-credential-runtime.md)  
Not a bug. Do **not** implement without explicit approval.

---

## What is deferred

A user-facing opt-in that would let a browser session persist a provider credential:

```
保存方式
 ● 僅本次工作階段    關閉或重新載入後需要重新輸入
 ○ 記住在此瀏覽器    金鑰會以本機明文儲存，安全性較低
```

Selecting the second option would be the only production caller of
`acknowledgeWebFallback()` (then `resetCredentialStore()`), routing secrets to the existing
`WebFallbackCredentialStore` (`localStorage` key `lunartide_credential_web_fallback`,
capability tag `persistent-insecure`). Selecting the first would call
`disableWebFallback()`.

## Why deferred

- Rune's primary product direction is mobile/native, where `NativeCredentialStore`
  (Capacitor SecureStorage) already provides a persistent secure path.
- On the web the alternative is plaintext `localStorage`, readable by any script on the
  origin. Browser reload convenience alone is not a sufficient reason to downgrade
  credential protection, so session-only (`MemoryCredentialStore`) remains the policy.
- Nothing is broken today: every request path fails safely with an explicit
  credential-required state, and the guest lounge keeps its calm fallback.

## Re-evaluation trigger

Reconsider only when Rune actually plans a browser-first deployment and users need their
provider credentials to survive reloads there.

## Prohibited until then

- Calling `acknowledgeWebFallback()` from production code.
- Writing an API key into `localStorage` (`lunartide_data` or any new key).
- Switching the web credential mode automatically or silently.
- Adding a second credential store or a Chat-owned/Guest-owned credential cache.
