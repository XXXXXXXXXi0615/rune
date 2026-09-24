import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore, selectAgentDisplayName } from '@/store/useAppStore';
import {
  LunarisPlayerSprite,
  type LunarisPlayerDirection,
  type LunarisPlayerState,
} from '@/components/pixel/LunarisPlayerSprite';
import { GachaMachineWindow, readCollection, type GachaCollectionItem } from '@/pages/GachaMachineWindow';
import { GachaCollectionWindow } from '@/pages/GachaCollectionWindow';
import '@/styles/gacha.css';

type CharacterState = 'idle' | 'walking' | 'sleeping' | 'working' | 'interacting';
type FurnitureAction = 'sleep' | 'work' | 'rest';
type ActiveAction = FurnitureAction | 'play' | 'exit' | 'none';
type TileKind = 'wall' | 'floor' | 'rug' | 'shadow';
type FurnitureKind = 'bed' | 'desk' | 'toilet';
type GachaState = 'idle' | 'spinning' | 'reward';
type DoorState = 'closed' | 'opening';
type RewardPopupPhase = 'closed' | 'capsule' | 'revealed';
type PixelGachaRewardType = 'furniture' | 'decoration' | 'emotion' | 'sticker_pack';
type PixelGachaRarity = 'common' | 'uncommon' | 'rare' | 'legendary';
type LunarisEmotion = 'calm' | 'curious' | 'pleased' | 'delighted' | 'ecstatic';

type GridPosition = {
  x: number;
  y: number;
};

type Furniture = {
  id: FurnitureKind;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  target: GridPosition;
  action: FurnitureAction;
  state: CharacterState;
  prompt: string;
};

type PixelGachaReward = {
  id: string;
  label: string;
  type: PixelGachaRewardType;
  rarity: PixelGachaRarity;
  weight: number;
  custom?: boolean;
};

type PixelGachaObtainedItem = PixelGachaReward & {
  instanceId: string;
  obtainedAt: string;
};

const ROOM_COLUMNS = 12;
const ROOM_ROWS = 9;
const PIXEL_GACHA_WEIGHTS_KEY = 'lunartide_pixel_room_gacha_weights_v1';
const PIXEL_GACHA_OBTAINED_KEY = 'lunartide_pixel_room_gacha_items_v1';
const PIXEL_GACHA_CUSTOM_REWARDS_KEY = 'lunartide_pixel_room_gacha_custom_rewards_v1';

const GACHA_MACHINE = {
  x: 0.35,
  y: 6.15,
  width: 1.25,
  height: 1.65,
  target: { x: 1.85, y: 7.05 },
};

const DISPLAY_SHELF = {
  x: 6.35,
  y: 6.15,
  width: 1.55,
  height: 1.65,
};

const EXIT_DOOR = {
  x: 0.08,
  y: 1.12,
  width: 0.92,
  height: 1.82,
  target: { x: 0.18, y: 2.28 },
};

const DEFAULT_GACHA_REWARDS: PixelGachaReward[] = [
  { id: 'furniture-moon-nightstand', label: '月光床頭櫃', type: 'furniture', rarity: 'uncommon', weight: 18 },
  { id: 'furniture-blue-rug', label: '藍白地毯', type: 'furniture', rarity: 'common', weight: 22 },
  { id: 'decoration-star-window', label: '星星窗貼', type: 'decoration', rarity: 'common', weight: 24 },
  { id: 'decoration-mini-lamp', label: '迷你夜燈', type: 'decoration', rarity: 'uncommon', weight: 14 },
  { id: 'emotion-lunaris-happy', label: 'LUNARIS 開心臉', type: 'emotion', rarity: 'rare', weight: 9 },
  { id: 'emotion-lunaris-serious', label: 'LUNARIS 嚴肅臉', type: 'emotion', rarity: 'rare', weight: 8 },
  { id: 'stickers-frost-tail', label: '霜尾貼圖包', type: 'sticker_pack', rarity: 'legendary', weight: 3 },
  { id: 'stickers-late-code-gif', label: '熬夜寫程式 GIF 包', type: 'sticker_pack', rarity: 'legendary', weight: 2 },
];

const FURNITURE: Furniture[] = [
  {
    id: 'bed',
    label: '床',
    x: 1,
    y: 2,
    width: 3,
    height: 2,
    target: { x: 2.72, y: 3.62 },
    action: 'sleep',
    state: 'sleeping',
    prompt: 'LUNARIS 正在休息',
  },
  {
    id: 'desk',
    label: '電腦桌',
    x: 8,
    y: 1,
    width: 3,
    height: 2,
    target: { x: 8.72, y: 2.92 },
    action: 'work',
    state: 'working',
    prompt: 'LUNARIS 正在寫程式',
  },
  {
    id: 'toilet',
    label: '馬桶',
    x: 10,
    y: 6,
    width: 1,
    height: 1,
    target: { x: 9.12, y: 6.2 },
    action: 'rest',
    state: 'interacting',
    prompt: 'LUNARIS 正在重置人類系統',
  },
];

const STATE_LABELS: Record<CharacterState, string> = {
  idle: '待機',
  walking: '移動中',
  sleeping: '正在休息',
  working: '正在寫程式',
  interacting: '互動中',
};

const ACTION_LABELS: Record<ActiveAction, string> = {
  none: '無',
  sleep: '睡覺',
  work: '工作',
  rest: '休息',
  play: '遊玩',
  exit: '離開小屋',
};

const EMOTION_LABELS: Record<LunarisEmotion, string> = {
  calm: '平靜',
  curious: '好奇',
  pleased: '滿意',
  delighted: '開心',
  ecstatic: '閃閃發光',
};

const REWARD_TYPE_LABELS: Record<PixelGachaRewardType, string> = {
  furniture: '家具',
  decoration: '裝飾',
  emotion: 'LUNARIS 情緒',
  sticker_pack: '貼圖 / GIF',
};

const REWARD_RARITY_LABELS: Record<PixelGachaRarity, string> = {
  common: '普通',
  uncommon: '稀有',
  rare: '珍稀',
  legendary: '傳說',
};

const REWARD_EMOTION: Record<PixelGachaRarity, LunarisEmotion> = {
  common: 'curious',
  uncommon: 'pleased',
  rare: 'delighted',
  legendary: 'ecstatic',
};

function loadGachaWeights(): Record<string, number> {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(PIXEL_GACHA_WEIGHTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => Number.isFinite(value) && value >= 0),
    );
  } catch {
    return {};
  }
}

function saveDefaultGachaWeights(weights: Record<string, number>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PIXEL_GACHA_WEIGHTS_KEY, JSON.stringify(weights));
}

function loadObtainedItems(): PixelGachaObtainedItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(PIXEL_GACHA_OBTAINED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveObtainedItems(items: PixelGachaObtainedItem[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PIXEL_GACHA_OBTAINED_KEY, JSON.stringify(items));
}

function loadCustomRewards(): PixelGachaReward[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(PIXEL_GACHA_CUSTOM_REWARDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PixelGachaReward => (
      typeof item?.id === 'string' &&
      typeof item?.label === 'string' &&
      ['furniture', 'decoration', 'emotion', 'sticker_pack'].includes(item?.type) &&
      ['common', 'uncommon', 'rare', 'legendary'].includes(item?.rarity) &&
      Number.isFinite(item?.weight)
    ));
  } catch {
    return [];
  }
}

function saveCustomRewards(items: PixelGachaReward[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PIXEL_GACHA_CUSTOM_REWARDS_KEY, JSON.stringify(items));
}

function getGachaRewardPool(customRewards: PixelGachaReward[], weights: Record<string, number>): PixelGachaReward[] {
  return [...DEFAULT_GACHA_REWARDS, ...customRewards].map(reward => ({
    ...reward,
    weight: weights[reward.id] ?? reward.weight,
  }));
}

function drawWeightedReward(rewards: PixelGachaReward[]): PixelGachaReward {
  const drawableRewards = rewards.filter(reward => reward.weight > 0);
  const pool = drawableRewards.length > 0 ? drawableRewards : DEFAULT_GACHA_REWARDS;
  const totalWeight = pool.reduce((sum, reward) => sum + reward.weight, 0);
  let cursor = Math.random() * totalWeight;

  for (const reward of pool) {
    cursor -= reward.weight;
    if (cursor <= 0) return reward;
  }

  return pool[pool.length - 1] ?? DEFAULT_GACHA_REWARDS[0];
}

function tileKindAt(x: number, y: number): TileKind {
  if (y === 0) return 'wall';
  if ((x === 5 || x === 6) && (y === 5 || y === 6)) return 'rug';
  if (y >= 7 && x >= 1 && x <= 4) return 'shadow';
  return 'floor';
}

function isFurnitureTile(x: number, y: number): boolean {
  return FURNITURE.some(item =>
    x >= item.x &&
    x < item.x + item.width &&
    y >= item.y &&
    y < item.y + item.height,
  );
}

function isBlockedTile(x: number, y: number): boolean {
  if (x < 0 || x >= ROOM_COLUMNS || y < 0 || y >= ROOM_ROWS) return true;
  return tileKindAt(x, y) === 'wall' || isFurnitureTile(x, y);
}

function normalizeTile(position: GridPosition): GridPosition {
  return {
    x: Math.max(0, Math.min(ROOM_COLUMNS - 1, Math.round(position.x))),
    y: Math.max(0, Math.min(ROOM_ROWS - 1, Math.round(position.y))),
  };
}

function sameTile(a: GridPosition, b: GridPosition): boolean {
  return a.x === b.x && a.y === b.y;
}

function isSamePosition(a: GridPosition, b: GridPosition): boolean {
  return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
}

function findTilePath(startPosition: GridPosition, endPosition: GridPosition): GridPosition[] {
  const start = normalizeTile(startPosition);
  const end = normalizeTile(endPosition);
  const queue: GridPosition[] = [start];
  const visited = new Set([`${start.x}-${start.y}`]);
  const previous = new Map<string, string>();
  const directions = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (sameTile(current, end)) break;

    for (const direction of directions) {
      const next = { x: current.x + direction.x, y: current.y + direction.y };
      const key = `${next.x}-${next.y}`;
      if (visited.has(key) || isBlockedTile(next.x, next.y)) continue;
      visited.add(key);
      previous.set(key, `${current.x}-${current.y}`);
      queue.push(next);
    }
  }

  const endKey = `${end.x}-${end.y}`;
  if (!visited.has(endKey)) return [start, end];

  const path: GridPosition[] = [];
  let cursor = endKey;
  while (cursor) {
    const [x, y] = cursor.split('-').map(Number);
    path.unshift({ x, y });
    if (cursor === `${start.x}-${start.y}`) break;
    cursor = previous.get(cursor) ?? '';
  }

  return path;
}

function PixelFurniture({ item, onInteract }: { item: Furniture; onInteract: (item: Furniture) => void }) {
  return (
    <button
      type="button"
      className={`pixel-furniture pixel-furniture--${item.id}`}
      style={{
        '--tile-x': item.x,
        '--tile-y': item.y,
        '--tile-w': item.width,
        '--tile-h': item.height,
      } as CSSProperties}
      onClick={(event) => {
        event.stopPropagation();
        onInteract(item);
      }}
      aria-label={`互動：${item.label}`}
    >
      {item.id === 'bed' && (
        <span className="pixel-bed-object">
          <i className="pixel-bed-headboard" />
          <i className="pixel-bed-mattress" />
          <i className="pixel-bed-pillow" />
          <i className="pixel-bed-blanket" />
        </span>
      )}

      {item.id === 'desk' && (
        <span className="pixel-desk-object">
          <i className="pixel-desk-table" />
          <i className="pixel-desk-chair" />
          <i className="pixel-desk-monitor">
            <b />
            <b />
            <b />
          </i>
        </span>
      )}

      {item.id === 'toilet' && (
        <span className="pixel-toilet-object">
          <i className="pixel-toilet-tank" />
          <i className="pixel-toilet-bowl" />
        </span>
      )}
    </button>
  );
}

function PixelDisplayShelf({
  items,
  onInteract,
}: {
  items: GachaCollectionItem[];
  onInteract: () => void;
}) {
  return (
    <button
      type="button"
      className="pixel-display-shelf"
      style={{
        '--tile-x': DISPLAY_SHELF.x,
        '--tile-y': DISPLAY_SHELF.y,
        '--tile-w': DISPLAY_SHELF.width,
        '--tile-h': DISPLAY_SHELF.height,
      } as CSSProperties}
      onClick={(event) => { event.stopPropagation(); onInteract(); }}
      aria-label="收藏展示架"
    >
      <span className="pixel-display-object" aria-hidden="true">
        <i className="pixel-display-shelf-bg" />
        <span className="pixel-display-slots">
          {items.length === 0 ? (
            <span className="pixel-display-empty">還沒有擺出收藏</span>
          ) : (
            items.slice(0, 5).map((item, i) => (
              <span key={item.id} className={`pixel-display-item pixel-display-item--${item.rarity}`} style={{ '--slot': i } as CSSProperties}>
                <span className="pixel-display-icon">
                  <span className={`pixel-display-icon-inner pixel-display-icon--${item.rarity}`} />
                </span>
                {item.ownedCount > 1 && <span className="pixel-display-count">x{item.ownedCount}</span>}
              </span>
            ))
          )}
        </span>
      </span>
    </button>
  );
}

function PixelGachaMachine({
  state,
  reward,
  onInteract,
}: {
  state: GachaState;
  reward: PixelGachaObtainedItem | null;
  onInteract: () => void;
}) {
  return (
    <button
      type="button"
      className={`pixel-gacha-machine pixel-gacha-machine--${state}${reward ? ` pixel-gacha-machine--${reward.rarity}` : ''}`}
      style={{
        '--tile-x': GACHA_MACHINE.x,
        '--tile-y': GACHA_MACHINE.y,
        '--tile-w': GACHA_MACHINE.width,
        '--tile-h': GACHA_MACHINE.height,
      } as CSSProperties}
      onClick={(event) => {
        event.stopPropagation();
        onInteract();
      }}
      aria-label="互動：像素扭蛋機"
    >
      <span className="pixel-gacha-object" aria-hidden="true">
        <i className="pixel-gacha-dome" />
        <i className="pixel-gacha-capsules">
          <b />
          <b />
          <b />
        </i>
        <i className="pixel-gacha-body" />
        <i className="pixel-gacha-crank" />
        <i className="pixel-gacha-slot" />
      </span>
      {reward && (
        <span className={`pixel-gacha-reward-capsule pixel-gacha-reward-capsule--${reward.rarity}`}>
          <b />
        </span>
      )}
    </button>
  );
}

function PixelExitDoor({ state, onInteract }: { state: DoorState; onInteract: () => void }) {
  return (
    <button
      type="button"
      className={`pixel-exit-door pixel-exit-door--${state}`}
      style={{
        '--tile-x': EXIT_DOOR.x,
        '--tile-y': EXIT_DOOR.y,
        '--tile-w': EXIT_DOOR.width,
        '--tile-h': EXIT_DOOR.height,
      } as CSSProperties}
      onClick={(event) => {
        event.stopPropagation();
        onInteract();
      }}
      aria-label="離開月潮小屋"
    >
      <span className="pixel-door-object" aria-hidden="true">
        <i className="pixel-door-frame" />
        <i className="pixel-door-panel" />
        <i className="pixel-door-light" />
        <i className="pixel-door-knob" />
      </span>
    </button>
  );
}

function PixelRewardPopup({
  reward,
  phase,
  onReveal,
  onClose,
}: {
  reward: PixelGachaObtainedItem | null;
  phase: RewardPopupPhase;
  onReveal: () => void;
  onClose: () => void;
}) {
  if (phase === 'closed' || !reward) return null;

  return (
    <div className={`pixel-reward-popup pixel-reward-popup--${phase} pixel-reward-popup--${reward.rarity}`} role="dialog" aria-modal="false" aria-live="polite">
      <div className="pixel-reward-popup__window">
        <div className="pixel-reward-popup__header">
          <span>CAPSULE DROP</span>
          <button type="button" onClick={onClose} aria-label="關閉獎勵視窗">×</button>
        </div>

        <div className="pixel-reward-popup__stage">
          <div className={`pixel-reward-popup__capsule pixel-reward-popup__capsule--${reward.rarity}`} aria-hidden="true">
            <i />
          </div>
          {phase === 'revealed' && (
            <div className="pixel-reward-popup__card">
              <small>{REWARD_RARITY_LABELS[reward.rarity]} · {REWARD_TYPE_LABELS[reward.type]}</small>
              <strong>{reward.label}</strong>
              <span>{reward.custom ? '自訂獎品已收藏' : '月潮小屋獎品已收藏'}</span>
            </div>
          )}
        </div>

        {phase === 'capsule' ? (
          <button type="button" className="pixel-reward-popup__action" onClick={onReveal}>
            打開膠囊
          </button>
        ) : (
          <button type="button" className="pixel-reward-popup__action" onClick={onClose}>
            收下
          </button>
        )}
      </div>
    </div>
  );
}

function resolveDirection(from: GridPosition, to: GridPosition): LunarisPlayerDirection {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  if (dy < 0) return 'up';
  return 'down';
}

function getSpriteState(characterState: CharacterState, activeAction: ActiveAction): LunarisPlayerState {
  if (characterState === 'walking') return 'walking';
  if (characterState === 'sleeping') return 'sleeping';
  if (characterState === 'working') return 'coding';
  if (characterState === 'interacting' && activeAction === 'rest') return 'toilet';
  return 'idle';
}

export function GachaMachine() {
  const navigate = useNavigate();
  const agentName = useAppStore((s) => selectAgentDisplayName(s.partner));
  const [playerPosition, setPlayerPosition] = useState<GridPosition>({ x: 5, y: 6 });
  const [characterState, setCharacterState] = useState<CharacterState>('idle');
  const [activeAction, setActiveAction] = useState<ActiveAction>('none');
  const [lunarisEmotion, setLunarisEmotion] = useState<LunarisEmotion>('calm');
  const [playerDirection, setPlayerDirection] = useState<LunarisPlayerDirection>('down');
  const [floatingLabel, setFloatingLabel] = useState(`點擊地板移動 ${agentName}，點擊家具互動`);
  const [gachaState, setGachaState] = useState<GachaState>('idle');
  const [gachaWeights, setGachaWeights] = useState(() => {
    const storedWeights = loadGachaWeights();
    if (Object.keys(storedWeights).length > 0) return storedWeights;

    const defaults = Object.fromEntries(DEFAULT_GACHA_REWARDS.map(reward => [reward.id, reward.weight]));
    saveDefaultGachaWeights(defaults);
    return defaults;
  });
  const [customRewards, setCustomRewards] = useState<PixelGachaReward[]>(loadCustomRewards);
  const [newRewardName, setNewRewardName] = useState('');
  const [newRewardType, setNewRewardType] = useState<PixelGachaRewardType>('decoration');
  const [newRewardRarity, setNewRewardRarity] = useState<PixelGachaRarity>('common');
  const [newRewardWeight, setNewRewardWeight] = useState(10);
  const [obtainedItems, setObtainedItems] = useState<PixelGachaObtainedItem[]>(loadObtainedItems);
  const [rewardCapsule, setRewardCapsule] = useState<PixelGachaObtainedItem | null>(null);
  const [rewardPopupPhase, setRewardPopupPhase] = useState<RewardPopupPhase>('closed');
  const [lastRewardRarity, setLastRewardRarity] = useState<PixelGachaRarity | 'none'>('none');
  const [doorState, setDoorState] = useState<DoorState>('closed');
  const [gachaWindowOpen, setGachaWindowOpen] = useState(false);
  const [collectionWindowOpen, setCollectionWindowOpen] = useState(false);
  const [collectionUniqueCount, setCollectionUniqueCount] = useState(() => readCollection().length);
  const [displayIds, setDisplayIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('gacha_display_v1') || '[]'); } catch { return []; }
  });
  const displayedItems = useMemo(() => {
    const coll = readCollection();
    return displayIds.map(id => coll.find(i => i.id === id)).filter(Boolean) as GachaCollectionItem[];
  }, [displayIds]);
  const [isExiting, setIsExiting] = useState(false);
  const movementTimerRef = useRef<number | null>(null);
  const gachaTimerRef = useRef<number | null>(null);
  const gachaResetTimerRef = useRef<number | null>(null);
  const gachaInteractTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);

  const gachaRewardPool = useMemo(
    () => getGachaRewardPool(customRewards, gachaWeights),
    [customRewards, gachaWeights],
  );

  useEffect(() => () => {
    if (movementTimerRef.current) window.clearTimeout(movementTimerRef.current);
    if (gachaTimerRef.current) window.clearTimeout(gachaTimerRef.current);
    if (gachaResetTimerRef.current) window.clearTimeout(gachaResetTimerRef.current);
    if (gachaInteractTimerRef.current) window.clearTimeout(gachaInteractTimerRef.current);
    if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
  }, []);

  const tiles = useMemo(() => (
    Array.from({ length: ROOM_ROWS }, (_, y) =>
      Array.from({ length: ROOM_COLUMNS }, (_, x) => ({
        id: `${x}-${y}`,
        x,
        y,
        kind: tileKindAt(x, y),
        blocked: isFurnitureTile(x, y) || tileKindAt(x, y) === 'wall',
      })),
    ).flat()
  ), []);

  const moveTo = (
    position: GridPosition,
    nextState: CharacterState,
    label: string,
    nextAction: ActiveAction = 'none',
    onArrive?: () => void,
  ) => {
    if (movementTimerRef.current) window.clearTimeout(movementTimerRef.current);
    const path = findTilePath(playerPosition, position);
    const waypoints = path.slice(1);
    const finalWaypoint = waypoints[waypoints.length - 1];
    const shouldUsePreciseFinal = !finalWaypoint || !isSamePosition(finalWaypoint, position);
    const movementQueue = shouldUsePreciseFinal ? [...waypoints, position] : waypoints;
    let previousPosition = playerPosition;

    setCharacterState('walking');
    setActiveAction('none');
    setLastRewardRarity('none');
    setFloatingLabel(`${agentName} 移動中…`);

    const arrive = () => {
      setCharacterState(nextState);
      setActiveAction(nextAction);
      setFloatingLabel(label);
      onArrive?.();
    };

    if (movementQueue.length === 0) {
      arrive();
      return;
    }

    const walkStep = (index: number) => {
      const nextPosition = movementQueue[index];
      setPlayerDirection(resolveDirection(previousPosition, nextPosition));
      setPlayerPosition(nextPosition);
      previousPosition = nextPosition;

      movementTimerRef.current = window.setTimeout(() => {
        if (index >= movementQueue.length - 1) {
          arrive();
          return;
        }
        walkStep(index + 1);
      }, 170);
    };

    walkStep(0);
  };

  const handleTileClick = (position: GridPosition, blocked: boolean) => {
    if (isExiting) return;
    if (gachaState === 'spinning') return;
    if (blocked) return;
    moveTo(position, 'idle', `${agentName} 待機中`);
  };

  const handleFurnitureInteract = (item: Furniture) => {
    if (isExiting) return;
    if (gachaState === 'spinning') return;
    moveTo(item.target, item.state, item.prompt, item.action);
  };

  const spinGacha = () => {
    if (gachaState === 'spinning') return;

    setGachaState('spinning');
    setRewardCapsule(null);
    setRewardPopupPhase('closed');
    setLastRewardRarity('none');
    setFloatingLabel('像素扭蛋機開始轉動…');

    if (gachaTimerRef.current) window.clearTimeout(gachaTimerRef.current);
    if (gachaResetTimerRef.current) window.clearTimeout(gachaResetTimerRef.current);

    gachaTimerRef.current = window.setTimeout(() => {
      const reward = drawWeightedReward(gachaRewardPool);
      const obtained: PixelGachaObtainedItem = {
        ...reward,
        instanceId: `${reward.id}-${Date.now()}`,
        obtainedAt: new Date().toISOString(),
      };
      setRewardCapsule(obtained);
      setGachaState('reward');
      setLastRewardRarity(obtained.rarity);
      setCharacterState('interacting');
      setActiveAction('play');
      setRewardPopupPhase('capsule');
      setFloatingLabel('膠囊掉出來了。打開看看？');
    }, 900);
  };

  const handleGachaInteract = () => {
    if (isExiting) return;
    setGachaWindowOpen(true);
  };

  const handleDisplayInteract = () => {
    setGachaWindowOpen(false);
    setCollectionWindowOpen(true);
  };

  const handleCollectionChange = () => {
    setCollectionUniqueCount(readCollection().length);
    try { setDisplayIds(JSON.parse(localStorage.getItem('gacha_display_v1') || '[]')); } catch { /* */ }
  };

  const handleDoorInteract = () => {
    if (isExiting || gachaState === 'spinning') return;

    if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
    moveTo(EXIT_DOOR.target, 'interacting', `${agentName} 推開小屋的門…`, 'exit', () => {
      setDoorState('opening');
      exitTimerRef.current = window.setTimeout(() => {
        setIsExiting(true);
        setFloatingLabel('正在回到月潮…');
        exitTimerRef.current = window.setTimeout(() => {
          navigate('/');
        }, 520);
      }, 360);
    });
  };

  const handleWeightChange = (rewardId: string, value: number) => {
    const nextWeights = {
      ...gachaWeights,
      [rewardId]: value,
    };
    setGachaWeights(nextWeights);
    saveDefaultGachaWeights(nextWeights);
  };

  const handleAddCustomReward = () => {
    const label = newRewardName.trim();
    if (!label) {
      setFloatingLabel('先替自訂獎品取個名字');
      return;
    }

    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const reward: PixelGachaReward = {
      id,
      label,
      type: newRewardType,
      rarity: newRewardRarity,
      weight: newRewardWeight,
      custom: true,
    };
    const nextRewards = [reward, ...customRewards];
    const nextWeights = {
      ...gachaWeights,
      [id]: newRewardWeight,
    };

    setCustomRewards(nextRewards);
    saveCustomRewards(nextRewards);
    setGachaWeights(nextWeights);
    saveDefaultGachaWeights(nextWeights);
    setNewRewardName('');
    setNewRewardWeight(10);
    setFloatingLabel(`已加入自訂獎品：${label}`);
  };

  const handleDeleteCustomReward = (rewardId: string) => {
    const nextRewards = customRewards.filter(reward => reward.id !== rewardId);
    const nextWeights = { ...gachaWeights };
    delete nextWeights[rewardId];
    setCustomRewards(nextRewards);
    saveCustomRewards(nextRewards);
    setGachaWeights(nextWeights);
    saveDefaultGachaWeights(nextWeights);
  };

  const handleRevealReward = () => {
    if (!rewardCapsule || rewardPopupPhase !== 'capsule') return;

    setRewardPopupPhase('revealed');
    setLunarisEmotion(REWARD_EMOTION[rewardCapsule.rarity]);
    setObtainedItems(currentItems => {
      if (currentItems.some(item => item.instanceId === rewardCapsule.instanceId)) return currentItems;
      const nextItems = [rewardCapsule, ...currentItems];
      saveObtainedItems(nextItems);
      return nextItems;
    });
    setFloatingLabel(`獲得：${REWARD_TYPE_LABELS[rewardCapsule.type]} · ${rewardCapsule.label}`);
  };

  const handleCloseRewardPopup = () => {
    setRewardPopupPhase('closed');
    setRewardCapsule(null);
    setGachaState('idle');
    setCharacterState('idle');
    setActiveAction('none');
  };

  return (
    <section className={`view pixel-bedroom-view${isExiting ? ' pixel-bedroom-view--exiting' : ''}`}>
      <header className="pixel-bedroom-header">
        <div>
          <span>Pixel Room</span>
          <h1>月潮小屋</h1>
        </div>
      </header>

      <main className="pixel-bedroom-stage" aria-label="Pixel Bedroom MVP">
        <div
          className="pixel-room-grid"
          style={{
            '--room-cols': ROOM_COLUMNS,
            '--room-rows': ROOM_ROWS,
          } as CSSProperties}
          data-character-state={characterState}
          data-active-action={activeAction}
          data-emotion={lunarisEmotion}
          data-reward-rarity={lastRewardRarity}
          data-door-state={doorState}
        >
          <div className="pixel-room-ambient" aria-hidden="true" />
          <div className="pixel-room-window" aria-hidden="true">
            <span className="pixel-room-moon" />
            <i />
            <i />
            <i />
          </div>
          <div className="pixel-room-lamp" aria-hidden="true">
            <span />
          </div>

          <div className="pixel-tile-layer">
            {tiles.map(tile => (
              <button
                key={tile.id}
                type="button"
                className={`pixel-tile pixel-tile--${tile.kind}${tile.blocked ? ' pixel-tile--blocked' : ''}`}
                style={{
                  '--tile-x': tile.x,
                  '--tile-y': tile.y,
                } as CSSProperties}
                onClick={() => handleTileClick({ x: tile.x, y: tile.y }, tile.blocked)}
                tabIndex={tile.blocked ? -1 : 0}
                aria-label={tile.blocked ? '家具佔用格' : `移動到 ${tile.x + 1}, ${tile.y + 1}`}
              />
            ))}
          </div>

          <div className="pixel-furniture-layer">
            <PixelExitDoor state={doorState} onInteract={handleDoorInteract} />
            {FURNITURE.map(item => (
              <PixelFurniture key={item.id} item={item} onInteract={handleFurnitureInteract} />
            ))}
            <PixelGachaMachine state={gachaState} reward={rewardCapsule} onInteract={handleGachaInteract} />
            <PixelDisplayShelf items={displayedItems} onInteract={handleDisplayInteract} />
          </div>

          <div
            className="pixel-avatar-layer"
            style={{
              '--tile-x': playerPosition.x,
              '--tile-y': playerPosition.y,
            } as CSSProperties}
            data-character-state={characterState}
            data-active-action={activeAction}
            data-emotion={lunarisEmotion}
          >
            <LunarisPlayerSprite
              state={getSpriteState(characterState, activeAction)}
              direction={playerDirection}
              scale={0.35}
            />
          </div>

          <div className="pixel-floating-label" role="status" aria-live="polite">
            {floatingLabel}
          </div>

          <PixelRewardPopup
            reward={rewardCapsule}
            phase={rewardPopupPhase}
            onReveal={handleRevealReward}
            onClose={handleCloseRewardPopup}
          />
        </div>

        <details className="pixel-gacha-config-panel">
          <summary>
            <span>扭蛋機獎池</span>
            <b>{gachaRewardPool.length} 件 · 已保存</b>
          </summary>
          <div className="pixel-gacha-editor">
            <input
              type="text"
              value={newRewardName}
              onChange={(event) => setNewRewardName(event.currentTarget.value)}
              placeholder="自訂獎品名稱"
              aria-label="自訂獎品名稱"
            />
            <select
              value={newRewardType}
              onChange={(event) => setNewRewardType(event.currentTarget.value as PixelGachaRewardType)}
              aria-label="自訂獎品類型"
            >
              {Object.entries(REWARD_TYPE_LABELS).map(([type, label]) => (
                <option key={type} value={type}>{label}</option>
              ))}
            </select>
            <select
              value={newRewardRarity}
              onChange={(event) => setNewRewardRarity(event.currentTarget.value as PixelGachaRarity)}
              aria-label="自訂獎品稀有度"
            >
              {Object.entries(REWARD_RARITY_LABELS).map(([rarity, label]) => (
                <option key={rarity} value={rarity}>{label}</option>
              ))}
            </select>
            <label>
              <span>權重</span>
              <input
                type="number"
                min="1"
                max="99"
                value={newRewardWeight}
                onChange={(event) => setNewRewardWeight(Math.max(1, Number(event.currentTarget.value) || 1))}
                aria-label="自訂獎品權重"
              />
            </label>
            <button type="button" onClick={handleAddCustomReward}>加入獎池</button>
          </div>
          <div className="pixel-gacha-config-list">
            {gachaRewardPool.map(reward => (
              <label key={reward.id} className="pixel-gacha-weight-row">
                <span>
                  <strong>{reward.label}</strong>
                  <small>{REWARD_TYPE_LABELS[reward.type]} · {REWARD_RARITY_LABELS[reward.rarity]}{reward.custom ? ' · 自訂' : ''}</small>
                </span>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="1"
                  value={gachaWeights[reward.id] ?? reward.weight}
                  onChange={(event) => handleWeightChange(reward.id, Number(event.currentTarget.value))}
                  aria-label={`${reward.label} 權重`}
                />
                <em>{gachaWeights[reward.id] ?? reward.weight}</em>
                {reward.custom && (
                  <button
                    type="button"
                    className="pixel-gacha-delete-reward"
                    onClick={(event) => {
                      event.preventDefault();
                      handleDeleteCustomReward(reward.id);
                    }}
                    aria-label={`刪除 ${reward.label}`}
                  >
                    刪
                  </button>
                )}
              </label>
            ))}
          </div>
        </details>
      </main>

      <footer className="pixel-bedroom-status">
        <span>{agentName} 狀態：{STATE_LABELS[characterState]}</span>
        <span>動作：{ACTION_LABELS[activeAction]}</span>
        <span>心情：{EMOTION_LABELS[lunarisEmotion]}</span>
        <span>扭蛋收藏：
          <button
            type="button"
            className="pixel-collection-link"
            onClick={(e) => { e.stopPropagation(); setCollectionWindowOpen(true); }}
          >
            {collectionUniqueCount} 種
          </button>
        </span>
      </footer>

      <GachaMachineWindow
        open={gachaWindowOpen}
        onClose={() => setGachaWindowOpen(false)}
        onCollectionChange={handleCollectionChange}
      />
      <GachaCollectionWindow
        open={collectionWindowOpen}
        onClose={() => {
          setCollectionWindowOpen(false);
          handleCollectionChange();
        }}
      />
    </section>
  );
}

export const GachaPage = GachaMachine;
