import { SharedIdentityEditor } from '@/components/identity/SharedIdentityEditor';

/** User-side thin wrapper of the shared identity editor (kept for import stability). */
export function ProfileEditorModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return <SharedIdentityEditor mode="user" isOpen={isOpen} onClose={onClose} />;
}
