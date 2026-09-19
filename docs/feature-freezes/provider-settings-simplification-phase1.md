# Provider Settings Simplification Phase 1 Freeze

Status: **FROZEN**

## Canonical ownership

- Provider registry owner: `src/ai/providerAdapter.ts`, exposed through `listProviderAdapterMeta()`.
- Model discovery pipeline: `fetchProviderModels()` → `getProviderModels()` → `useProviderModels()`.
- Persisted model source of truth: `ProviderConfig.model`, paired with `ProviderConfig.type`.
- Stable runtime source identity: ``sourceId = `${providerId}:${modelId}```.
- Endpoint and request-format ownership remains in the provider adapter/runtime layer.
- API Key and credential ownership remains in the existing credential runtime. Provider configuration does not own plaintext credentials.

## Frozen behavior

- Provider Settings uses a compact Provider selector followed by a provider-scoped Model ID field.
- Dynamic discovery results, the current persisted Model ID, and manual Model ID entry share the same field.
- Unknown and future Model IDs remain editable, saveable, and reloadable.
- Discovery failure preserves manual Model ID entry.
- Switching Provider removes the previous Provider's runtime discovery results.
- `Custom` continues to persist through the existing `type = custom`, `model`, and `baseUrl` fields.
- Advanced settings are collapsed by default.
- `MODEL_SOURCE_SEEDS` is retired from presentation and is not a user-facing model inventory.

## Reopen boundary

A future change requires an explicit reopen reason before it may:

- restore a fixed model catalog;
- create a second provider registry;
- create a second model persistence owner;
- write API Keys back into provider configuration;
- add a provider-specific UI fork;
- change credential ownership;
- change transport behavior; or
- change provider request runtime behavior.

Version-specific capability and cost metadata may remain in their existing owners. They are not model-selection inventory and must not become the Provider Settings catalog.

## Closure evidence

- Dynamic Model Closure Playwright: Chromium/WebKit 10/10.
- Credential regression: 14/14.
- Mobile Provider editor: 2/2.
- Model source catalog unit tests: 9/9.
- TypeScript: PASS.
- Production build: PASS.
- `git diff --check`: PASS.
- Responsive matrix: 360, 390, 430, and 1440 in light and dark themes.

Evidence screenshots: `docs/reports/provider-settings-dynamic-closure/`.
Closure report: `docs/reports/provider-settings-simplification-phase1-dynamic-model-closure.md`.
