import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AvatarAssetImage } from './ConversationAvatars';
import { BUILTIN_LUNARIS, useCharacterStore } from '@/store/useCharacterStore';
import { CharacterStudio } from './CharacterStudio/CharacterStudio';
import type { CharacterProfile } from '@/types';
import './CharacterLibrary.css';

export function CharacterLibrary({ open, onClose, onStartChat }: { open: boolean; onClose: () => void; onStartChat: (characterId: string) => void }) {
  const characters = useCharacterStore((state) => state.characters);
  const folders = useCharacterStore((state) => state.folders);
  const updateCharacter = useCharacterStore((state) => state.updateCharacter);
  const duplicateCharacter = useCharacterStore((state) => state.duplicateCharacter);
  const archiveCharacter = useCharacterStore((state) => state.archiveCharacter);
  const deleteCharacter = useCharacterStore((state) => state.deleteCharacter);
  const [query, setQuery] = useState(''); const [folderId, setFolderId] = useState('all'); const [tag, setTag] = useState('all'); const [editing, setEditing] = useState<CharacterProfile | null | 'new'>(null);
  const tags = useMemo(() => [...new Set(characters.flatMap((item) => item.tags))], [characters]);
  const visible = characters.filter((item) => !item.isArchived && (folderId === 'all' || item.folderId === folderId) && (tag === 'all' || item.tags.includes(tag)) && `${item.name} ${item.subtitle} ${item.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  if (!open) return null;
  return createPortal(
    <>
      <div className="character-library-backdrop">
        <section className="character-library" role="dialog" aria-modal="true" aria-label="角色庫">
          <header>
            <div><p>CHARACTER LIBRARY</p><h1>角色庫</h1></div>
            <button type="button" onClick={onClose} aria-label="關閉角色庫">×</button>
          </header>
          <div className="character-library-toolbar">
            <input aria-label="搜尋角色" placeholder="搜尋角色" value={query} onChange={(event) => setQuery(event.target.value)}/>
            <select aria-label="資料夾篩選" value={folderId} onChange={(event) => setFolderId(event.target.value)}>
              <option value="all">所有資料夾</option>
              {folders.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select aria-label="標籤篩選" value={tag} onChange={(event) => setTag(event.target.value)}>
              <option value="all">所有標籤</option>
              {tags.map((item) => <option key={item}>{item}</option>)}
            </select>
            <button type="button" className="primary" onClick={() => setEditing('new')}>新增角色</button>
          </div>
          <div className="character-grid">
            {visible.map((character) => (
              <article className="character-card" key={character.id}>
                <div className="character-card-avatar">
                  {character.avatarAssetId ? (
                    <AvatarAssetImage assetId={character.avatarAssetId} alt={character.name} crop={character.avatarCrop}/>
                  ) : (
                    <span>{character.name.charAt(0)}</span>
                  )}
                </div>
                <div className="character-card-copy">
                  <h2>{character.name} {character.isBuiltIn && <small>內建</small>}</h2>
                  <p>{character.shortIdentity || character.subtitle || '尚未設定簡短身份'}</p>
                  <div>
                    {folders.find((item) => item.id === character.folderId)?.name}
                    {character.tags.slice(0, 2).map((item) => <span key={item}>#{item}</span>)}
                  </div>
                  <small>模型：{character.modelMode === 'custom' && character.providerId ? '自訂' : character.modelProfileId ? '已連結' : '沿用聊天設定'} · 最近使用 {character.lastUsedAt ? new Date(character.lastUsedAt).toLocaleDateString() : '—'}</small>
                </div>
                <div className="character-card-actions">
                  <button type="button" onClick={() => onStartChat(character.id)}>開始私聊</button>
                  <button type="button" onClick={() => setEditing(character)}>編輯</button>
                  <button type="button" onClick={() => updateCharacter(character.id, { isFavorite: !character.isFavorite })}>
                    {character.isFavorite ? '取消收藏' : '收藏'}
                  </button>
                  <button type="button" onClick={() => duplicateCharacter(character.id)}>複製</button>
                  <button type="button" onClick={() => archiveCharacter(character.id)}>
                    {character.isBuiltIn ? '隱藏' : '封存'}
                  </button>
                  <button type="button" disabled={character.isBuiltIn} title={character.isBuiltIn ? '內建角色不可刪除' : undefined} onClick={() => deleteCharacter(character.id)}>
                    刪除
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
      {editing && (
        <CharacterStudio
          character={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onDeleted={() => setEditing(null)}
        />
      )}
    </>,
    document.body,
  );
}
