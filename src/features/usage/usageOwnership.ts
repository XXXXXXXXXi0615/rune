const USAGE_OWNER_LOCK = 'lunartide-usage-tracking-owner-v1';

export interface UsageOwnershipHandle {
  acquire: (onAcquired: () => void | Promise<void>) => void;
  release: () => void;
  isOwner: () => boolean;
  dispose: () => void;
}

/**
 * Coordinates one foreground usage owner across same-origin tabs.
 * Web Locks supplies crash-safe release when a document disappears.
 */
export function createUsageOwnershipHandle(): UsageOwnershipHandle {
  let owner = false;
  let pending = false;
  let disposed = false;
  let abortController: AbortController | null = null;
  let releaseOwner: (() => void) | null = null;

  const release = () => {
    abortController?.abort();
    abortController = null;
    releaseOwner?.();
    releaseOwner = null;
    owner = false;
    pending = false;
  };

  const acquire = (onAcquired: () => void | Promise<void>) => {
    if (disposed || owner || pending) return;

    if (!navigator.locks) {
      owner = true;
      void onAcquired();
      return;
    }

    pending = true;
    const controller = new AbortController();
    abortController = controller;
    void navigator.locks.request(
      USAGE_OWNER_LOCK,
      { mode: 'exclusive', signal: controller.signal },
      async () => {
        if (disposed || controller.signal.aborted) return;
        pending = false;
        owner = true;
        await onAcquired();
        if (disposed || controller.signal.aborted || !owner) return;
        await new Promise<void>((resolve) => {
          releaseOwner = resolve;
        });
      },
    ).catch((error: unknown) => {
      pending = false;
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (import.meta.env.DEV) console.error('[usage-owner] lock request failed', error);
    });
  };

  return {
    acquire,
    release,
    isOwner: () => owner,
    dispose: () => {
      disposed = true;
      release();
    },
  };
}
