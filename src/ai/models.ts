/**
 * models.ts — Dynamic Provider Model Fetching + Cache
 *
 * fetchProviderModels() is dispatched from testConnection.ts.
 * This module wraps it with localStorage caching (24h TTL)
 * and provides a React hook for UI components.
 */

import type { ProviderConfig, ProviderType } from '@/types';
import { getProviderAdapterMeta, listProviderAdapterMeta } from './providerAdapter';
import { fetchProviderModels as rawFetch } from './testConnection';

/** Runtime/catalog view. Persistence remains ProviderConfig.type + model. */
export interface ModelSource {
  sourceId: string;
  providerId: ProviderType;
  modelId: string;
  name: string;
  providerLabel: string;
  cataloged: boolean;
}

type ModelSourceInput = Pick<ModelSource, 'providerId' | 'modelId' | 'name'>;

export type ModelSourcePath = 'dynamic' | 'manual';

export interface ProviderModelSourceCoverage {
  providerId: ProviderType;
  providerLabel: string;
  paths: ModelSourcePath[];
  status: 'READY' | 'BLOCKED';
}

export function modelSourceId(providerId: ProviderType, modelId: string): string {
  return `${providerId}:${modelId}`;
}

function toModelSource(seed: ModelSourceInput, cataloged: boolean): ModelSource {
  return {
    sourceId: modelSourceId(seed.providerId, seed.modelId),
    providerId: seed.providerId,
    modelId: seed.modelId,
    name: seed.name,
    providerLabel: getProviderAdapterMeta(seed.providerId).displayName,
    cataloged,
  };
}

/** Pure provider-scoped projection for API discovery results. */
export function modelSourceFromProviderModel(
  providerId: ProviderType,
  remote: { id: string; name?: string },
): ModelSource {
  return toModelSource({
    providerId,
    modelId: remote.id,
    name: remote.name || remote.id,
  }, true);
}

/**
 * Coverage is derived from the adapter registry. Preset providers use the
 * existing dynamic discovery path; Custom keeps its existing manual path.
 */
export function listProviderModelSourceCoverage(): ProviderModelSourceCoverage[] {
  return listProviderAdapterMeta().map((adapter) => {
    const paths: ModelSourcePath[] = ['dynamic'];
    if (adapter.id === 'custom') paths.push('manual');
    return {
      providerId: adapter.id,
      providerLabel: adapter.displayName,
      paths,
      status: paths.length > 0 ? 'READY' : 'BLOCKED',
    };
  });
}

/** Restore without guessing or changing either persisted identity component. */
export function resolvePersistedModelSource(providerId: ProviderType, modelId: string): ModelSource {
  return toModelSource({ providerId, modelId, name: modelId }, false);
}

/** Apply both identity components in one state update. */
export function applyModelSourceSelection<T extends { type: ProviderType; model: string }>(
  draft: T,
  source: Pick<ModelSource, 'providerId' | 'modelId'>,
): T {
  return { ...draft, type: source.providerId, model: source.modelId };
}

/* ── Cache ── */

const CACHE_KEY = 'provider_models_cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  models: { id: string; name: string }[];
  updatedAt: number;
}

interface CacheStore {
  [compositeKey: string]: CacheEntry;
}

function providerCacheKey(p: { type: ProviderType; baseUrl: string; apiKey: string; credentialId?: string }): string {
  const identity = (p as any).credentialId || p.type;
  const url = p.baseUrl.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
  return `${p.type}|${url}|${identity}`;
}

function loadCache(): CacheStore {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* corrupt */ }
  return {};
}

function saveCache(store: CacheStore) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(store)); } catch { /* quota */ }
}

function getCached(key: string): CacheEntry | null {
  const store = loadCache();
  const entry = store[key];
  if (!entry) return null;
  if (Date.now() - entry.updatedAt > CACHE_TTL) {
    delete store[key];
    saveCache(store);
    return null;
  }
  return entry;
}

function setCached(key: string, models: { id: string; name: string }[]) {
  const store = loadCache();
  store[key] = { models, updatedAt: Date.now() };
  saveCache(store);
}

/** Invalidate the cache for a given provider (e.g. after manual sync). */
export function invalidateModelsCache(provider: { type: ProviderType; baseUrl: string; apiKey: string }) {
  const key = providerCacheKey(provider);
  const store = loadCache();
  delete store[key];
  saveCache(store);
}

/**
 * Fetch models with cache layer.
 * Returns cached data if valid (< 24h), otherwise fetches and caches.
 */
export async function getProviderModels(
  provider: ProviderConfig,
  forceRefresh = false,
): Promise<ModelSource[] | null> {
  const key = providerCacheKey(provider);

  if (!forceRefresh) {
    const cached = getCached(key);
    if (cached) {
      return cached.models.map((model) => modelSourceFromProviderModel(provider.type, model));
    }
  }

  const raw = await rawFetch(provider);
  if (!raw) return null;

  const models = raw.map((m) => (typeof m === 'string' ? { id: m, name: m } : { id: m.id, name: m.name || m.id }));
  setCached(key, models);
  return models.map((model) => modelSourceFromProviderModel(provider.type, model));
}

/* ── React Hook ── */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseModelsResult {
  models: ModelSource[];
  loading: boolean;
  error: string | null;
  sync: () => void;
}

export function useProviderModels(
  type: ProviderType,
  apiKey: string,
  baseUrl: string,
): UseModelsResult {
  const [models, setModels] = useState<ModelSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const key = `${type}::${baseUrl}::${apiKey.slice(-8)}`;

  const fetch = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const mockProvider: ProviderConfig = {
        id: '__hook__',
        name: '',
        type,
        baseUrl,
        apiKey,
        model: '',
        enabled: true,
        isDefault: false,
        streamingEnabled: false,
        thinkingUiEnabled: false,
        temperature: 0.7,
        maxTokens: 4096,
        contextMessageLimit: 20,
        modelsEndpoint: '',
        chatEndpoint: '',
        createdAt: 0,
        updatedAt: 0,
      };
      const result = await getProviderModels(mockProvider, force);
      if (mountedRef.current) {
        if (result) {
          setModels(result);
        } else {
          setModels([]);
          setError('無法取得模型，請檢查 API Key');
        }
      }
    } catch {
      if (mountedRef.current) {
        setModels([]);
        setError('無法取得模型，請檢查 API Key');
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [type, baseUrl, apiKey]);

  // Auto-fetch on mount & when key changes
  useEffect(() => {
    mountedRef.current = true;
    if (apiKey.trim().length > 0) {
      fetch(false);
    } else {
      setModels([]);
      setError(null);
      setLoading(false);
    }
    return () => { mountedRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const sync = useCallback(() => {
    invalidateModelsCache({ type, baseUrl, apiKey });
    fetch(true);
  }, [type, baseUrl, apiKey, fetch]);

  return { models, loading, error, sync };
}
