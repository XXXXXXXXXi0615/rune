/**
 * GachaMachineWindow — Pixel Room gacha machine popup.
 *
 * State machine: idle → inserted → spinning → dropped → opening → revealed.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './GachaMachineWindow.css';

type GachaState = 'idle' | 'inserted' | 'spinning' | 'dropped' | 'opening' | 'revealed';
type GachaRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

interface GachaReward {
  id: string;
  label: string;
  rarity: GachaRarity;
  description: string;
}

export interface GachaCollectionItem {
  id: string;
  name: string;
  rarity: GachaRarity;
  description?: string;
  acquiredAt: string;
  ownedCount: number;
}

interface GachaMachineWindowProps {
  open: boolean;
  onClose: () => void;
  onCollectionChange?: () => void;
}

const COLLECTION_KEY = 'gacha_collection_v1';

function loadCollection(): GachaCollectionItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(COLLECTION_KEY) || '[]');
    return raw.map((item: any) => ({
      id: item.id || '',
      name: item.name || item.label || '',
      rarity: item.rarity || 'common',
      description: item.description || '',
      acquiredAt: item.acquiredAt || new Date().toISOString(),
      ownedCount: item.ownedCount ?? 1,
    } as GachaCollectionItem));
  } catch { return []; }
}

function saveCollection(items: GachaCollectionItem[]) {
  try { localStorage.setItem(COLLECTION_KEY, JSON.stringify(items)); } catch { /* */ }
}

export function readCollection(): GachaCollectionItem[] {
  return loadCollection();
}

const REWARD_POOL: GachaReward[] = [
  { id: 'moon-nightstand', label: '月光床頭櫃', rarity: 'uncommon', description: '會自動發光的小邊櫃，適合放睡前讀的書。' },
  { id: 'blue-rug', label: '藍白地毯', rarity: 'common', description: '踩上去軟軟的，LUNARIS 很喜歡在上面打滾。' },
  { id: 'star-window', label: '星星窗貼', rarity: 'common', description: '貼在窗戶上，晚上會有星星投影。' },
  { id: 'mini-lamp', label: '迷你夜燈', rarity: 'uncommon', description: '一盞會變色的蘑菇燈。' },
  { id: 'lunaris-happy', label: 'LUNARIS 開心臉', rarity: 'rare', description: 'LUNARIS 換上了開心的表情！每次登入都會對你笑。' },
  { id: 'lunaris-serious', label: 'LUNARIS 嚴肅臉', rarity: 'rare', description: 'LUNARIS 換上了嚴肅的表情。適合認真工作的日子。' },
  { id: 'frost-tail', label: '霜尾貼圖包', rarity: 'legendary', description: '超稀有！LUNARIS 霜尾主題聊天貼圖，冰系技能特效。' },
  { id: 'late-code-gif', label: '熬夜程式 GIF 包', rarity: 'legendary', description: '傳說級！動態 LUNARIS 熬夜寫程式 GIF，適合深夜對話。' },
];

const RARITY_COLORS: Record<GachaRarity, string> = {
  common: '#a0b8c8',
  uncommon: '#6fcf97',
  rare: '#e8a55a',
  legendary: '#d4a0ff',
};

const RARITY_LABELS: Record<GachaRarity, string> = {
  common: '普通',
  uncommon: '精良',
  rare: '稀有',
  legendary: '傳說',
};

function drawReward(): GachaReward {
  const weights = { common: 46, uncommon: 28, rare: 17, legendary: 9 };
  const pool = REWARD_POOL.filter((r) => weights[r.rarity]);
  const total = pool.reduce((s, r) => s + weights[r.rarity], 0);
  let roll = Math.random() * total;
  for (const r of pool) {
    roll -= weights[r.rarity];
    if (roll <= 0) return r;
  }
  return pool[0];
}

export function GachaMachineWindow({ open, onClose, onCollectionChange }: GachaMachineWindowProps) {
  const [state, setState] = useState<GachaState>('idle');
  const [reward, setReward] = useState<GachaReward | null>(null);
  const [collected, setCollected] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState('idle');
    setReward(null);
    setCollected(false);
  }, []);

  useEffect(() => {
    if (open) reset();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleInsertCoin = () => {
    setState('inserted');
    timerRef.current = setTimeout(() => setState('spinning'), 600);
  };

  useEffect(() => {
    if (state !== 'spinning') return;
    timerRef.current = setTimeout(() => {
      setReward(drawReward());
      setState('dropped');
    }, 1600);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [state]);

  const handleOpenCapsule = () => {
    setState('opening');
    timerRef.current = setTimeout(() => setState('revealed'), 500);
  };

  const handleCollect = () => {
    if (!reward || collected) return;
    const items = loadCollection();
    const existing = items.find((i) => i.id === reward.id);
    if (existing) {
      existing.ownedCount += 1;
    } else {
      items.push({
        id: reward.id,
        name: reward.label,
        rarity: reward.rarity,
        description: reward.description,
        acquiredAt: new Date().toISOString(),
        ownedCount: 1,
      });
    }
    saveCollection(items);
    setCollected(true);
    onCollectionChange?.();
  };

  const handlePlayAgain = () => {
    reset();
    setTimeout(() => handleInsertCoin(), 200);
  };

  if (!open) return null;

  const machineShaking = state === 'spinning';
  const capsuleDropped = state === 'dropped' || state === 'opening' || state === 'revealed';

  return createPortal(
    <div className="gmw-backdrop" onClick={onClose}>
      <div className="gmw-window" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="像素扭蛋機">
        <div className="gmw-header">
          <span className="gmw-title">PIXEL GACHA</span>
          <button type="button" className="gmw-close" onClick={onClose} aria-label="關閉">×</button>
        </div>

        <div className="gmw-machine-area">
          <div className="gmw-dome">
            <div className="gmw-dome-glass" />
            <div className={`gmw-capsules ${machineShaking ? 'gmw-capsules--shake' : ''}`}>
              <span className="gmw-cap gmw-cap--1" />
              <span className="gmw-cap gmw-cap--2" />
              <span className="gmw-cap gmw-cap--3" />
              <span className="gmw-cap gmw-cap--4" />
              <span className="gmw-cap gmw-cap--5" />
            </div>
          </div>

          <div className={`gmw-body ${machineShaking ? 'gmw-body--shake' : ''}`}>
            <div className="gmw-coin-slot" />
            <div className={`gmw-crank ${machineShaking ? 'gmw-crank--spin' : ''}`} />
            <div className="gmw-dispenser">
              {capsuleDropped && reward && (
                <span className={`gmw-dispensed-cap gmw-dispensed-cap--${reward.rarity}`} />
              )}
            </div>
          </div>
        </div>

        <div className="gmw-controls">
          {state === 'idle' && (
            <button type="button" className="gmw-btn" onClick={handleInsertCoin}>
              ◇ 投入一枚
            </button>
          )}

          {state === 'inserted' && (
            <p className="gmw-hint">硬幣落入… 扭蛋機正在準備…</p>
          )}

          {state === 'spinning' && (
            <p className="gmw-hint">轉動中… 膠囊在機器裡滾來滾去…</p>
          )}

          {state === 'dropped' && (
            <button type="button" className="gmw-btn gmw-btn--glow" onClick={handleOpenCapsule}>
              ◇ 打開膠囊
            </button>
          )}

          {state === 'opening' && (
            <p className="gmw-hint">膠囊正在打開…</p>
          )}

          {state === 'revealed' && reward && (
            <div className={`gmw-reward gmw-reward--${reward.rarity}`}>
              <div className="gmw-reward-rarity" style={{ color: RARITY_COLORS[reward.rarity] }}>
                {RARITY_LABELS[reward.rarity]}
              </div>
              <div className="gmw-reward-name">{reward.label}</div>
              <div className="gmw-reward-desc">{reward.description}</div>
              <div className="gmw-reward-btns">
                <button
                  type="button"
                  className={`gmw-btn gmw-btn--glow${collected ? ' gmw-btn--done' : ''}`}
                  onClick={handleCollect}
                  disabled={collected}
                >
                  {collected ? '已收藏' : '收進扭蛋收藏'}
                </button>
                <button type="button" className="gmw-btn gmw-btn--ghost" onClick={handlePlayAgain}>
                  再扭一次
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="gmw-collection">
          收藏：{loadCollection().length} 種
        </div>
      </div>
    </div>,
    document.body,
  );
}
