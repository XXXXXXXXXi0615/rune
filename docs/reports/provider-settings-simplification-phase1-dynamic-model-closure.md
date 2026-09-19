# Provider Settings Simplification Phase 1 — Dynamic Model Closure

Status: **PASS**

## Result

Provider Settings now uses a compact searchable Provider selector backed by the existing provider adapter registry, followed by a provider-scoped Model ID field. The primary UI no longer depends on a fixed catalog of concrete model versions.

## Ownership

- Provider selector: `providerAdapter` registry through `listProviderAdapterMeta()`.
- Dynamic discovery: `fetchProviderModels()` → `getProviderModels()` → `useProviderModels()`.
- Persistence: existing `ProviderConfig.type + ProviderConfig.model`.
- Source identity: ``${providerId}:${modelId}``.
- Endpoints and request formats: existing provider adapter/runtime owners.
- Credentials: existing credential runtime, unchanged.

## Behavior

- Dynamic results are scoped to the selected Provider.
- Manual Model ID input remains available with or without discovery.
- Unknown persisted Model IDs remain current, editable, and reload-safe.
- A discovery failure does not block manual Model ID entry.
- OpenRouter accepts arbitrary routed Model IDs.
- Custom uses the existing `type`, `model`, and `baseUrl` fields.
- Preset endpoints remain automatic until explicitly overridden.
- Advanced settings remain collapsed by default.

## Static seed audit

`MODEL_SOURCE_SEEDS` was stale presentation inventory and was removed. No runtime fallback depended on it. Dynamic discovery, the current persisted Model ID, and manual entry now provide the complete UI path. Version-specific capability and cost mappings remain in their canonical non-presentation owners.

## Exact manifest

### Production

- `src/components/settings/ProviderConfigWindow.tsx`
- `src/components/settings/ProviderConfigWindow.css`
- `src/ai/models.ts`
- `src/ai/providerAdapter.ts`
- `src/components/settings/AdvancedSettingsPage.tsx`
- `src/components/settings/AiConfigDrawer.tsx`

### Tests

- `src/utils/providerModelSourceCatalog.test.ts`
- `e2e/provider-settings-simplification-phase1.spec.ts`
- `e2e/mobile-chat-settings-phase2.spec.ts`

### Documentation and evidence

- `docs/reports/provider-settings-simplification-phase1-dynamic-model-closure.md`
- `docs/reports/provider-settings-dynamic-closure/*.png`
- `docs/feature-freezes/provider-settings-simplification-phase1.md`

## Verification

- Playwright Dynamic Closure, Chromium/WebKit: 10/10.
- Credential regression, Chromium/WebKit: 14/14.
- Mobile Provider editor, Chromium/WebKit: 2/2.
- Catalog unit tests: 9/9.
- TypeScript: PASS.
- Build: PASS.
- `git diff --check`: PASS.
- Responsive light/dark matrix at 360, 390, 430, and 1440: PASS.

The canonical development server remained reachable on `127.0.0.1:5173` and was not restarted or stopped.
