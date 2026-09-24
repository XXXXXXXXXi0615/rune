import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { RoomStatus } from '@/components/focus/FocusRoomPanel';
import type { FocusRoomType } from '@/components/focus/types';
import { RegisteredPetVisual } from '@/components/pet/RegisteredPetVisual';
import { useAppStore } from '@/store/useAppStore';
import { useFocusSessionStore } from '@/store/useFocusSessionStore';
import { usePetStore } from '@/store/usePetStore';
import { useFocusWindowStore } from '@/store/useFocusWindowStore';
import { getPetDefinition, semanticFromResolved, shouldRenderPet } from '@/pets/petRegistry';
import { mapTodayMoodToPetMood, resolvePetState } from '@/features/pet/petController';
import { getPetCapabilityManifest } from '@/features/desktopPet/petCapabilityRegistry';
import { resolvePetPresentation } from '@/features/desktopPet/resolvePetPresentation';
import type { PetSceneState } from '@/features/desktopPet/types';
import { PET_INTERACTION_DURATION_MS, shouldStartPetInteraction, showManualPetControls } from '@/features/pet/petInteraction';
import { clampPetRoomPosition, getPetRoomLayout } from '@/features/pet/petRoomLayout';
import type { PetAction, PetEmotion, PetInteraction, PetRoomPosition } from '@/features/pet/types';

const EMOTIONS: Array<{ id: PetEmotion; label: string }> = [
  { id: 'happy', label: '開心' }, { id: 'calm', label: '平靜' },
  { id: 'sad', label: '難過' }, { id: 'tired', label: '疲憊' },
];
const ACTIONS: Array<{ id: PetAction; label: string }> = [
  { id: 'idle', label: '安靜待著' }, { id: 'work', label: '專心做事' },
  { id: 'walk', label: '到處走走' }, { id: 'cheer', label: '替你打氣' },
  { id: 'cry', label: '需要安慰' }, { id: 'rest', label: '坐下休息' }, { id: 'sleep', label: '好好睡覺' },
];

interface TideboundRoomPetProps {
  roomId: FocusRoomType;
  status: RoomStatus;
}

interface DragState {
  pointerId: number;
  stage: DOMRect;
  width: number;
  height: number;
}

export function TideboundRoomPet({ roomId, status }: TideboundRoomPetProps) {
  const selectedPetId = usePetStore((state) => state.selectedPetId);
  const placementMode = usePetStore((state) => state.placementMode);
  const controlMode = usePetStore((state) => state.controlMode);
  const manualEmotion = usePetStore((state) => state.manualEmotion);
  const manualAction = usePetStore((state) => state.manualAction);
  const position = usePetStore((state) => state.roomPositionsByPet[state.selectedPetId]?.[roomId] ?? state.roomPositions[roomId]);
  const animationEnabled = usePetStore((state) => state.animationEnabled);
  const petPreference = usePetStore((state) => state.petPreferences[state.selectedPetId]);
  const tideboundOpen = useFocusWindowStore((state) => state.isOpen && !state.isMinimized);
  const setControlMode = usePetStore((state) => state.setControlMode);
  const setManualEmotion = usePetStore((state) => state.setManualEmotion);
  const setManualAction = usePetStore((state) => state.setManualAction);
  const setRoomPosition = usePetStore((state) => state.setRoomPosition);
  const resetRoomPosition = usePetStore((state) => state.resetRoomPosition);
  const todayMood = useAppStore((state) => state.todayMood);
  const settlement = useFocusSessionStore((state) => state.lastSettlement);
  const [interaction, setInteraction] = useState<PetInteraction | null>(null);
  const [interactionExpiresAt, setInteractionExpiresAt] = useState<number>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
  const [draftPosition, setDraftPosition] = useState(position);
  const [dragging, setDragging] = useState(false);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 480px)').matches);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const interactionTimer = useRef<number | null>(null);
  const movedRef = useRef(false);
  const pointerFocusRef = useRef(false);

  const layout = getPetRoomLayout(roomId, isMobile);
  const definition = getPetDefinition(selectedPetId);
  const capability = getPetCapabilityManifest(selectedPetId);

  useEffect(() => setDraftPosition(clampPetRoomPosition(position, layout)), [layout, position]);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 480px)');
    const update = () => setIsMobile(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => () => {
    if (interactionTimer.current !== null) window.clearTimeout(interactionTimer.current);
  }, []);

  const outcome = settlement?.outcome === 'completed'
    ? 'completed'
    : settlement?.outcome === 'abandoned'
      ? 'abandoned'
      : settlement?.outcome === 'early_exit' ? 'interrupted' : null;

  const resolved = useMemo(() => resolvePetState({
    userMood: mapTodayMoodToPetMood(todayMood),
    tideboundStatus: status,
    tideboundResult: outcome,
    interaction,
    interactionExpiresAt,
    controlMode,
    manualEmotion,
    manualAction,
    timeOfDay: new Date().getHours(),
  }), [controlMode, interaction, interactionExpiresAt, manualAction, manualEmotion, outcome, status, todayMood]);

  const startInteraction = (next: PetInteraction) => {
    if (!shouldStartPetInteraction(interaction, next, interactionTimer.current !== null)) return;
    if (interactionTimer.current !== null) window.clearTimeout(interactionTimer.current);
    const expiresAt = Date.now() + PET_INTERACTION_DURATION_MS;
    setInteraction(next);
    setInteractionExpiresAt(expiresAt);
    setMenuOpen(false);
    interactionTimer.current = window.setTimeout(() => {
      setInteraction(null);
      setInteractionExpiresAt(undefined);
      interactionTimer.current = null;
    }, PET_INTERACTION_DURATION_MS);
  };

  const openMenu = () => {
    if (movedRef.current || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setMenuPosition({ left: Math.min(window.innerWidth - 250, Math.max(12, rect.left - 80)), top: Math.min(window.innerHeight - 310, rect.bottom + 8) });
    setMenuOpen(true);
  };

  const updateFromPointer = (clientX: number, clientY: number) => {
    const drag = dragRef.current;
    if (!drag) return;
    const raw = { x: (clientX - drag.stage.left) / drag.stage.width, y: (clientY - drag.stage.top) / drag.stage.height };
    setDraftPosition(clampPetRoomPosition(raw, layout, { width: drag.width / drag.stage.width, height: drag.height / drag.stage.height }));
  };

  const commitDrag = useCallback((pointerId: number, clientX: number, clientY: number) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== pointerId) return;
    const next = clampPetRoomPosition({
      x: (clientX - drag.stage.left) / drag.stage.width,
      y: (clientY - drag.stage.top) / drag.stage.height,
    }, layout, { width: drag.width / drag.stage.width, height: drag.height / drag.stage.height });
    setDraftPosition(next);
    setRoomPosition(roomId, next, selectedPetId);
    const button = buttonRef.current;
    if (button?.hasPointerCapture(pointerId)) button.releasePointerCapture(pointerId);
    dragRef.current = null;
    setDragging(false);
    window.setTimeout(() => {
      movedRef.current = false;
      pointerFocusRef.current = false;
    }, 0);
  }, [layout, roomId, selectedPetId, setRoomPosition]);

  useEffect(() => {
    if (!dragging) return;
    const finish = (event: PointerEvent) => commitDrag(event.pointerId, event.clientX, event.clientY);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [commitDrag, dragging]);

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    pointerFocusRef.current = true;
    setKeyboardFocused(false);
    const stageElement = event.currentTarget.closest('.focus-room-card-scene');
    if (!(stageElement instanceof HTMLElement)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const buttonRect = event.currentTarget.getBoundingClientRect();
    dragRef.current = { pointerId: event.pointerId, stage: stageElement.getBoundingClientRect(), width: buttonRect.width, height: buttonRect.height };
    movedRef.current = false;
    setDragging(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    event.stopPropagation();
    movedRef.current = true;
    updateFromPointer(event.clientX, event.clientY);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    commitDrag(event.pointerId, event.clientX, event.clientY);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const deltas: Partial<Record<string, [number, number]>> = {
      ArrowLeft: [-0.025, 0], ArrowRight: [0.025, 0], ArrowUp: [0, -0.025], ArrowDown: [0, 0.025],
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    const next = clampPetRoomPosition({ x: draftPosition.x + delta[0], y: draftPosition.y + delta[1] }, layout);
    setDraftPosition(next);
    setRoomPosition(roomId, next, selectedPetId);
  };

  if (placementMode === 'hidden' || !shouldRenderPet('tidebound', placementMode, tideboundOpen)) return null;

  const style = {
    '--room-pet-x': draftPosition.x,
    '--room-pet-y': draftPosition.y,
    '--room-pet-anchor-x': definition.tideboundAnchor.x,
    '--room-pet-anchor-y': definition.tideboundAnchor.y,
    '--room-pet-size': `${isMobile ? definition.tideboundSize.mobile : definition.tideboundSize.desktop}px`,
    '--room-pet-visual-offset-x': `${definition.tideboundVisualOffset.x}px`,
    '--room-pet-visual-offset-y': `${definition.tideboundVisualOffset.y}px`,
  } as CSSProperties;
  const sceneState: PetSceneState = resolved.action === 'work'
    ? 'working' : resolved.action === 'sleep' || resolved.action === 'rest'
      ? 'sleeping' : resolved.action === 'cheer' || resolved.emotion === 'happy'
        ? 'happy' : resolved.emotion === 'sad' ? 'error' : resolved.emotion === 'tired' ? 'warning' : 'idle';
  const transient = interaction && interactionExpiresAt ? {
    reactionId: capability.automaticStateMap[interaction === 'rest' ? 'sleeping' : 'happy'],
    startedAt: interactionExpiresAt - PET_INTERACTION_DURATION_MS,
    expiresAt: interactionExpiresAt,
    returnTarget: petPreference.behaviorMode,
  } as const : null;
  const presentation = resolvePetPresentation({ manifest: capability, preference: petPreference, sceneState, transient });

  return (
    <>
      <span className="tidebound-room-pet-layer" style={style} data-pet-state={resolved.animationId} data-pet-source={resolved.source}>
        <button
          ref={buttonRef}
          type="button"
          className={`tidebound-room-pet${dragging ? ' is-dragging' : ''}${menuOpen ? ' is-menu-open' : ''}${keyboardFocused ? ' is-keyboard-focused' : ''}`}
          aria-label={`${definition.displayName}，按下開啟互動，方向鍵可移動`}
          onClick={(event) => { event.stopPropagation(); openMenu(); }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          onKeyDown={onKeyDown}
          onBlur={() => setKeyboardFocused(false)}
          onFocus={(event) => {
            if (!pointerFocusRef.current && event.currentTarget.matches(':focus-visible')) setKeyboardFocused(true);
            pointerFocusRef.current = false;
          }}
        >
          <RegisteredPetVisual petId={selectedPetId} semantic={semanticFromResolved(resolved.action, resolved.emotion)} runtimeAssetId={presentation.presentation.assetId} renderer={presentation.presentation.renderer} scale={definition.tideboundScale * layout.scale} playing={animationEnabled} speed={petPreference.animationSpeed} loop={presentation.presentation.loop} />
        </button>
      </span>
      {menuOpen && createPortal(
        <div className="tidebound-pet-menu-backdrop" onPointerDown={() => setMenuOpen(false)}>
          <section className="tidebound-pet-menu" data-control-mode={controlMode} style={{ '--pet-menu-left': `${menuPosition.left}px`, '--pet-menu-top': `${menuPosition.top}px` } as CSSProperties} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} aria-label={`${definition.displayName}互動選單`}>
            <header><b>{definition.displayName}</b><button type="button" onClick={() => setMenuOpen(false)} aria-label="關閉">×</button></header>
            <div className="tidebound-pet-actions">
              <button type="button" onClick={() => startInteraction('pet')}>拍拍</button>
              <button type="button" onClick={() => startInteraction('encourage')}>鼓勵一下</button>
              <button type="button" onClick={() => startInteraction('rest')}>休息一下</button>
            </div>
            <div className="tidebound-pet-mode">
              <span>控制方式</span>
              <div><button type="button" className={controlMode === 'follow' ? 'is-active' : ''} onClick={() => setControlMode('follow')}>跟隨我的狀態</button><button type="button" className={controlMode === 'manual' ? 'is-active' : ''} onClick={() => setControlMode('manual')}>手動</button></div>
            </div>
            {showManualPetControls(controlMode) && <div className="tidebound-pet-manual-controls">
              <div className="tidebound-pet-manual">
                <label>現在的心情<select value={manualEmotion} onChange={(event) => setManualEmotion(event.target.value as PetEmotion)}>{EMOTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
                <label>現在在做什麼<select value={manualAction} onChange={(event) => setManualAction(event.target.value as PetAction)}>{ACTIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              </div>
              <button type="button" className="tidebound-pet-reset" onClick={() => { resetRoomPosition(roomId, selectedPetId); setMenuOpen(false); }}>重設位置</button>
            </div>}
          </section>
        </div>, document.body)}
    </>
  );
}
