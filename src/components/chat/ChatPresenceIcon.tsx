import type { ChatPresenceStatus } from '@/types';

export function ChatPresenceIcon({ status }: { status: ChatPresenceStatus }) {
  if (status === 'online') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </svg>
    );
  }
  if (status === 'invisible') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 3l18 18" />
        <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
        <path d="M9.9 4.2A10.7 10.7 0 0 1 12 4c5.5 0 9 8 9 8a17 17 0 0 1-2.1 3.2" />
        <path d="M6.6 6.6C4.2 8.3 3 12 3 12s3.5 8 9 8c1 0 2-.3 2.9-.7" />
      </svg>
    );
  }
  if (status === 'busy') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="M8.5 12h7" />
      </svg>
    );
  }
  if (status === 'syncing') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 7h-5V2" />
        <path d="M4 17h5v5" />
        <path d="M6.1 8a7 7 0 0 1 11.7-2.6L20 7" />
        <path d="M17.9 16A7 7 0 0 1 6.2 18.6L4 17" />
      </svg>
    );
  }
  if (status === 'local') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="18" height="14" rx="2" />
        <path d="M8 21h8" />
        <path d="M12 17v4" />
      </svg>
    );
  }
  if (status === 'quiet') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 12a9 9 0 1 1-6.4-8.6" />
        <path d="M21 6V2h-4" />
      </svg>
    );
  }
  if (status === 'disabled') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <line x1="9" y1="9" x2="15" y2="15" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === 'unlinked') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    );
  }
  // offline (default)
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M8 12h8" />
    </svg>
  );
}
