import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TideRailPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type TideRailProposalStatus = 'proposed' | 'advisory_open' | 'adjudicating' | 'adopted' | 'paused_by_interrupt' | 'rejected' | 'deferred' | 'superseded' | 'completed';
export type TideRailCategory = 'runtime_bug' | 'validation' | 'ux_polish' | 'feature' | 'refactor' | 'documentation';
export type TideRailUserVote = 'support' | 'oppose' | 'abstain';
export type TideRailSourceRefType = 'quest' | 'iteration' | 'bug' | 'acceptance' | 'manual_observation';

export interface TideRailDecision {
  verdict: 'adopt' | 'reject' | 'defer' | 'require_interruption_contract';
  rationale: string;
  appliedRules: string[];
  decidedBy: 'ai' | 'policy_engine';
  modelId?: string;
  policyVersion: string;
  confidence?: number;
  decidedAt: number;
}

export interface TideRailProposal {
  id: string;
  projectId: string;
  title: string;
  summary: string;
  category: TideRailCategory;
  priority: TideRailPriority;
  sourceRefs: Array<{ type: TideRailSourceRefType; id: string }>;
  impact: string;
  estimatedScope?: string;
  dependencies: string[];
  acceptanceCriteria: string[];
  completedCriteria: string[];
  firstAction: string;
  sourceRoute: string;
  started: boolean;
  status: TideRailProposalStatus;
  userAdvisory?: { vote: TideRailUserVote; reason?: string; votedAt: number };
  decision?: TideRailDecision;
  createdAt: number;
  updatedAt: number;
}
export type TideRailSourceType = 'quest' | 'todo' | 'manual' | 'drift';
export type TideRailMainlineStatus = 'active' | 'interrupted' | 'completed' | 'archived';
export type TideRailDriftStatus = 'inbox' | 'contract_required' | 'active_branch' | 'resolved';
export type TideRailTab = 'checkin' | 'hydration';

export interface TideRailAcceptanceCriterion {
  id: string;
  label: string;
  completed: boolean;
  required: boolean;
  completedAt?: string;
}

export interface TideRailMainline {
  id: string;
  title: string;
  sourceType: TideRailSourceType;
  sourceId?: string;
  status: TideRailMainlineStatus;
  priority: TideRailPriority;
  acceptanceCriteria: TideRailAcceptanceCriterion[];
  nextAction: string;
  sourceRoute: string;
  checkpoint: string;
  resumeNote: string;
  firstActionAfterResume: string;
  interruptionReason?: string;
  archiveReason?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface TideRailDriftItem {
  id: string;
  title: string;
  note?: string;
  priority: TideRailPriority;
  relationToMainline: string;
  sourceRoute: string;
  status: TideRailDriftStatus;
  capturedAgainstMainlineId?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface TideRailInterruptionContract {
  interruptionReason: string;
  currentCheckpoint: string;
  unfinishedCriteria: string;
  resumeNote: string;
  firstActionAfterResume: string;
}

export interface TideRailSessionClosure {
  id: string;
  sessionId: string;
  mainlineId?: string;
  completedWork: string[];
  unfinishedCriteria: string[];
  capturedDrift: number;
  blockedItems: number;
  nextFirstAction: string;
  createdAt: string;
}

export type SetMainlineInput = Pick<TideRailMainline, 'title' | 'sourceType' | 'priority' | 'acceptanceCriteria' | 'nextAction' | 'sourceRoute'> & {
  sourceId?: string;
};

export interface TideRailState {
  mainlines: TideRailMainline[];
  activeMainlineId: string | null;
  driftItems: TideRailDriftItem[];
  interruptedStack: string[];
  sessionClosures: TideRailSessionClosure[];
  isWindowOpen: boolean;
  activeTab: TideRailTab;
  migrationVersion: number;
  proposals: TideRailProposal[];
  activeMainlineProposalId: string | null;
  decisionLedger: Array<{ proposalId: string; decision: TideRailDecision }>;
  adjudicationGeneration: Record<string, number>;
  proposalInterruptionContracts: Array<{ proposalId: string; interruptedProposalId: string; reason: string; checkpoint: string; firstAction: string; resumeWhen: string; acceptance: string[]; createdAt: number }>;
  pausedProposalStack: string[];
  openWindow: (tab?: TideRailTab) => void;
  closeWindow: () => void;
  setActiveTab: (tab: TideRailTab) => void;
  setMainline: (input: SetMainlineInput, now?: number) => string;
  toggleCriterion: (criterionId: string, now?: number) => void;
  completeActiveMainline: (now?: number) => boolean;
  archiveActiveMainline: (reason: string, now?: number) => boolean;
  captureDrift: (input: Omit<TideRailDriftItem, 'id' | 'status' | 'capturedAgainstMainlineId' | 'createdAt' | 'resolvedAt'>, now?: number) => { id: string; requiresContract: boolean };
  interruptWithContract: (driftId: string, contract: TideRailInterruptionContract, now?: number) => boolean;
  resolveDrift: (id: string, now?: number) => void;
  resumePreviousMainline: (now?: number) => boolean;
  recordSessionClosure: (input: { sessionId: string; outcome: string; sessionTask?: string }, now?: number) => void;
  syncProposals: (proposals: TideRailProposal[]) => void;
  voteProposal: (id: string, vote: TideRailUserVote, reason?: string, now?: number) => boolean;
  acceptProposal: (id: string, now?: number) => boolean;
  deferProposal: (id: string, now?: number) => boolean;
  skipProposal: (id: string, now?: number) => boolean;
  beginAdjudication: (id: string) => number | null;
  applyDecision: (id: string, generation: number, decision: TideRailDecision) => boolean;
  cancelAdjudication: (id: string, generation: number) => void;
  runPolicyAdjudication: (id: string, now?: number) => TideRailDecision | null;
  confirmProposalInterruption: (id: string, now?: number) => boolean;
  completeActiveProposal: (now?: number) => boolean;
}

const iso = (now: number) => new Date(now).toISOString();
const makeId = (prefix: string, now: number) => `${prefix}-${now}-${Math.random().toString(36).slice(2, 8)}`;
const clampText = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export const canTideRailInterrupt = (priority: TideRailPriority) => priority === 'P0' || priority === 'P1';

export function sanitizeTideRailSourceRoute(route: string): string {
  const clean = clampText(route, 240).split(/[?#]/)[0] || '/';
  const sensitivePrefixes = ['/health', '/ledger', '/journal', '/diary', '/memory'];
  const sensitive = sensitivePrefixes.find((prefix) => clean === prefix || clean.startsWith(`${prefix}/`));
  return sensitive === '/diary' ? '/journal' : sensitive || clean;
}

export function buildTideRailAgentSummary(state: Pick<TideRailState, 'mainlines' | 'activeMainlineId' | 'driftItems'>) {
  const mainline = state.mainlines.find((item) => item.id === state.activeMainlineId);
  return {
    mainline: mainline ? {
      title: mainline.title,
      priority: mainline.priority,
      sourceType: mainline.sourceType,
      sourceRoute: sanitizeTideRailSourceRoute(mainline.sourceRoute),
      completedCriteria: mainline.acceptanceCriteria.filter((item) => item.completed).length,
      totalCriteria: mainline.acceptanceCriteria.length,
      nextAction: mainline.nextAction,
    } : null,
    drift: state.driftItems.filter((item) => item.status !== 'resolved').map((item) => ({
      title: item.title,
      priority: item.priority,
      relationToMainline: item.relationToMainline,
      sourceRoute: sanitizeTideRailSourceRoute(item.sourceRoute),
    })),
  };
}

function normalizeCriteria(criteria: TideRailAcceptanceCriterion[], id: string): TideRailAcceptanceCriterion[] {
  const source = Array.isArray(criteria) ? criteria : [];
  return source.slice(0, 24).map((item, index) => ({
    id: clampText(item?.id, 120) || `${id}:criterion:${index}`,
    label: clampText(item?.label, 240) || `驗收條件 ${index + 1}`,
    completed: Boolean(item?.completed),
    required: item?.required !== false,
    completedAt: item?.completedAt,
  }));
}

function createMainline(input: SetMainlineInput, now: number, id = makeId('mainline', now)): TideRailMainline {
  const title = clampText(input.title, 240) || '未命名主線';
  const criteria = normalizeCriteria(input.acceptanceCriteria, id);
  return {
    id,
    title,
    sourceType: input.sourceType,
    sourceId: clampText(input.sourceId, 160) || undefined,
    status: 'active',
    priority: input.priority,
    acceptanceCriteria: criteria.length ? criteria : [{ id: `${id}:done`, label: `完成：${title}`, completed: false, required: true }],
    nextAction: clampText(input.nextAction, 400) || '定義第一個可執行步驟',
    sourceRoute: sanitizeTideRailSourceRoute(input.sourceRoute),
    checkpoint: '',
    resumeNote: '',
    firstActionAfterResume: '',
    createdAt: iso(now),
    updatedAt: iso(now),
  };
}

export function validateTideRailDecision(value: unknown, decidedBy: TideRailDecision['decidedBy'], modelId?: string, now = Date.now()): TideRailDecision | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  const verdicts = ['adopt', 'reject', 'defer', 'require_interruption_contract'];
  if (!verdicts.includes(String(data.verdict)) || typeof data.rationale !== 'string' || !data.rationale.trim()) return null;
  if (!Array.isArray(data.appliedRules) || !data.appliedRules.length || data.appliedRules.some((rule) => typeof rule !== 'string' || !rule.trim())) return null;
  const confidence = typeof data.confidence === 'number' && data.confidence >= 0 && data.confidence <= 1 ? data.confidence : undefined;
  return { verdict: data.verdict as TideRailDecision['verdict'], rationale: data.rationale.trim().slice(0, 1200), appliedRules: (data.appliedRules as string[]).map((rule) => rule.trim().slice(0, 240)), decidedBy, modelId, policyVersion: 'tiderail-policy-v1', confidence, decidedAt: now };
}

export function decideTideRailByPolicy(proposal: TideRailProposal, active: TideRailProposal | null, now = Date.now()): TideRailDecision | null {
  if (proposal.decision || ['completed', 'superseded'].includes(proposal.status)) return null;
  let verdict: TideRailDecision['verdict'];
  let rationale: string;
  let rule: string;
  if (active && active.id !== proposal.id && (proposal.priority === 'P0' || proposal.priority === 'P1')) {
    verdict = 'require_interruption_contract'; rationale = `${proposal.priority} 可能中斷已開始主線；必須先公開 checkpoint、回軌時機與驗收條件。`; rule = 'P0/P1 中斷進行中主線前必須建立中斷契約';
  } else if (active && active.id !== proposal.id) {
    verdict = 'defer'; rationale = '收進偏航箱。現有主線尚未封口，無關 P2／P3 不得擴大未完成範圍。'; rule = '進行中主線優先於無關 P2/P3';
  } else if (proposal.priority === 'P0' || proposal.priority === 'P1' || proposal.category === 'validation') {
    verdict = 'adopt'; rationale = '採納。這項工作直接解除高優先阻塞或完成必要驗收，且沒有覆蓋另一條已開始主線。'; rule = 'P0/P1 Runtime 與必要驗收優先';
  } else {
    verdict = 'defer'; rationale = '收進偏航箱。它有價值，但目前沒有足夠證據讓它成為正式主線。'; rule = 'P2/P3 在缺少阻塞證據時延後';
  }
  return { verdict, rationale, appliedRules: [rule], decidedBy: 'policy_engine', policyVersion: 'tiderail-policy-v1', confidence: 1, decidedAt: now };
}

const initialState = {
  mainlines: [] as TideRailMainline[],
  activeMainlineId: null as string | null,
  driftItems: [] as TideRailDriftItem[],
  interruptedStack: [] as string[],
  sessionClosures: [] as TideRailSessionClosure[],
  isWindowOpen: false,
  activeTab: 'checkin' as TideRailTab,
  migrationVersion: 3,
  proposals: [] as TideRailProposal[],
  activeMainlineProposalId: null as string | null,
  decisionLedger: [] as Array<{ proposalId: string; decision: TideRailDecision }>,
  adjudicationGeneration: {} as Record<string, number>,
  proposalInterruptionContracts: [] as Array<{ proposalId: string; interruptedProposalId: string; reason: string; checkpoint: string; firstAction: string; resumeWhen: string; acceptance: string[]; createdAt: number }>,
  pausedProposalStack: [] as string[],
};

export const useTideRailStore = create<TideRailState>()(persist((set, get) => ({
  ...initialState,
  openWindow: (tab = 'checkin') => set({ isWindowOpen: true, activeTab: tab }),
  closeWindow: () => set({ isWindowOpen: false }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setMainline: (input, now = Date.now()) => {
    const current = selectActiveMainline(get());
    if (current) return current.id;
    const id = makeId('mainline', now);
    set((state) => ({ mainlines: [createMainline(input, now, id), ...state.mainlines], activeMainlineId: id }));
    return id;
  },
  toggleCriterion: (criterionId, now = Date.now()) => set((state) => {
    const proposal = state.proposals.find((item) => item.id === state.activeMainlineProposalId);
    if (proposal && criterionId.startsWith(`${proposal.id}:criterion:`)) {
      const index = Number(criterionId.split(':').at(-1));
      const label = proposal.acceptanceCriteria[index];
      if (!label) return state;
      const completedCriteria = proposal.completedCriteria.includes(label) ? proposal.completedCriteria.filter((item) => item !== label) : [...proposal.completedCriteria, label];
      return { proposals: state.proposals.map((item) => item.id === proposal.id ? { ...item, completedCriteria, updatedAt: now } : item) };
    }
    return { mainlines: state.mainlines.map((mainline) => mainline.id !== state.activeMainlineId ? mainline : {
      ...mainline,
      updatedAt: iso(now),
      acceptanceCriteria: mainline.acceptanceCriteria.map((criterion) => criterion.id !== criterionId ? criterion : {
        ...criterion,
        completed: !criterion.completed,
        completedAt: criterion.completed ? undefined : iso(now),
      }),
    }) };
  }),
  completeActiveMainline: (now = Date.now()) => {
    const state = get();
    if (state.activeMainlineProposalId) return get().completeActiveProposal(now);
    const active = state.mainlines.find((item) => item.id === state.activeMainlineId && item.status === 'active');
    if (!active || active.acceptanceCriteria.some((item) => item.required && !item.completed)) return false;
    set({
      activeMainlineId: null,
      mainlines: state.mainlines.map((item) => item.id === active.id ? { ...item, status: 'completed', completedAt: iso(now), updatedAt: iso(now) } : item),
      driftItems: state.driftItems.map((item) => item.status === 'active_branch' ? { ...item, status: 'resolved', resolvedAt: iso(now) } : item),
    });
    return true;
  },
  archiveActiveMainline: (reason, now = Date.now()) => {
    const archiveReason = clampText(reason, 600);
    const state = get();
    if (!state.activeMainlineId || !archiveReason) return false;
    set({
      activeMainlineId: null,
      mainlines: state.mainlines.map((item) => item.id === state.activeMainlineId ? { ...item, status: 'archived', archiveReason, updatedAt: iso(now) } : item),
    });
    return true;
  },
  captureDrift: (input, now = Date.now()) => {
    const id = makeId('drift', now);
    const requiresContract = canTideRailInterrupt(input.priority);
    const activeMainlineId = get().activeMainlineId || undefined;
    const sourceRoute = sanitizeTideRailSourceRoute(input.sourceRoute);
    const sensitive = ['/health', '/ledger', '/journal', '/memory'].includes(sourceRoute);
    const item: TideRailDriftItem = {
      id,
      title: clampText(input.title, 240) || '未命名偏航',
      note: sensitive ? undefined : clampText(input.note, 600) || undefined,
      priority: input.priority,
      relationToMainline: clampText(input.relationToMainline, 240) || '未指定',
      sourceRoute,
      status: requiresContract ? 'contract_required' : 'inbox',
      capturedAgainstMainlineId: activeMainlineId,
      createdAt: iso(now),
    };
    set((state) => ({ driftItems: [item, ...state.driftItems].slice(0, 160) }));
    return { id, requiresContract };
  },
  interruptWithContract: (driftId, contract, now = Date.now()) => {
    const state = get();
    const active = state.mainlines.find((item) => item.id === state.activeMainlineId && item.status === 'active');
    const drift = state.driftItems.find((item) => item.id === driftId && item.status === 'contract_required');
    const valid = [contract.interruptionReason, contract.currentCheckpoint, contract.unfinishedCriteria, contract.resumeNote, contract.firstActionAfterResume]
      .every((value) => clampText(value, 1200).length > 0);
    if (!active || !drift || !canTideRailInterrupt(drift.priority) || !valid) return false;
    const branch = createMainline({
      title: drift.title,
      sourceType: 'drift',
      sourceId: drift.id,
      priority: drift.priority,
      acceptanceCriteria: [{ id: `${drift.id}:resolve`, label: `處理完成：${drift.title}`, completed: false, required: true }],
      nextAction: clampText(drift.note, 400) || drift.title,
      sourceRoute: drift.sourceRoute,
    }, now);
    set({
      mainlines: [branch, ...state.mainlines.map((item) => item.id === active.id ? {
        ...item,
        status: 'interrupted' as const,
        interruptionReason: clampText(contract.interruptionReason, 600),
        checkpoint: clampText(contract.currentCheckpoint, 1200),
        resumeNote: clampText(contract.resumeNote, 1200),
        firstActionAfterResume: clampText(contract.firstActionAfterResume, 600),
        nextAction: clampText(contract.firstActionAfterResume, 600),
        updatedAt: iso(now),
      } : item)],
      activeMainlineId: branch.id,
      interruptedStack: [...state.interruptedStack.filter((id) => id !== active.id), active.id],
      driftItems: state.driftItems.map((item) => item.id === drift.id ? { ...item, status: 'active_branch' } : item),
    });
    return true;
  },
  resolveDrift: (id, now = Date.now()) => set((state) => ({
    driftItems: state.driftItems.map((item) => item.id === id ? { ...item, status: 'resolved', resolvedAt: iso(now) } : item),
  })),
  resumePreviousMainline: (now = Date.now()) => {
    const state = get();
    const previousId = state.interruptedStack.at(-1);
    const previous = state.mainlines.find((item) => item.id === previousId && item.status === 'interrupted');
    if (!previous) return false;
    const currentId = state.activeMainlineId;
    set({
      activeMainlineId: previous.id,
      interruptedStack: state.interruptedStack.slice(0, -1),
      mainlines: state.mainlines.map((item) => item.id === previous.id
        ? { ...item, status: 'active', nextAction: item.firstActionAfterResume || item.nextAction, updatedAt: iso(now) }
        : item.id === currentId && item.status === 'active'
          ? { ...item, status: 'completed', completedAt: iso(now), updatedAt: iso(now) }
          : item),
      driftItems: state.driftItems.map((item) => item.status === 'active_branch' ? { ...item, status: 'resolved', resolvedAt: iso(now) } : item),
    });
    return true;
  },
  recordSessionClosure: (input, now = Date.now()) => set((state) => {
    if (state.sessionClosures.some((item) => item.sessionId === input.sessionId)) return state;
    const active = state.mainlines.find((item) => item.id === state.activeMainlineId);
    const completedWork = active?.acceptanceCriteria.filter((item) => item.completed).map((item) => item.label) || [];
    const unfinishedCriteria = active?.acceptanceCriteria.filter((item) => !item.completed).map((item) => item.label) || [];
    const closure: TideRailSessionClosure = {
      id: `closure-${input.sessionId}`,
      sessionId: input.sessionId,
      mainlineId: active?.id,
      completedWork,
      unfinishedCriteria,
      capturedDrift: state.driftItems.filter((item) => item.capturedAgainstMainlineId === active?.id).length,
      blockedItems: state.driftItems.filter((item) => item.capturedAgainstMainlineId === active?.id && (item.priority === 'P0' || item.priority === 'P1') && item.status !== 'resolved').length,
      nextFirstAction: active?.nextAction || clampText(input.sessionTask, 400) || '重新指定今日主線',
      createdAt: iso(now),
    };
    return { sessionClosures: [closure, ...state.sessionClosures].slice(0, 80) };
  }),
  syncProposals: (incoming) => set((state) => {
    const existing = new Map(state.proposals.map((proposal) => [proposal.id, proposal]));
    const merged = incoming.map((proposal) => {
      const saved = existing.get(proposal.id);
      return saved ? { ...proposal, status: saved.status, userAdvisory: saved.userAdvisory, decision: saved.decision, completedCriteria: saved.completedCriteria, createdAt: saved.createdAt, updatedAt: Math.max(saved.updatedAt, proposal.updatedAt) } : proposal;
    });
    const retained = state.proposals.filter((proposal) => !incoming.some((item) => item.id === proposal.id));
    return { proposals: [...merged, ...retained] };
  }),
  voteProposal: (id, vote, reason, now = Date.now()) => {
    const proposal = get().proposals.find((item) => item.id === id);
    if (!proposal || proposal.decision || !['proposed', 'advisory_open'].includes(proposal.status)) return false;
    set((state) => ({ proposals: state.proposals.map((item) => item.id === id ? { ...item, status: 'advisory_open', userAdvisory: { vote, reason: clampText(reason, 180) || undefined, votedAt: now }, updatedAt: now } : item) }));
    return true;
  },
  acceptProposal: (id, now = Date.now()) => {
    const state = get();
    const proposal = state.proposals.find((item) => item.id === id);
    if (!proposal || proposal.decision || ['completed', 'superseded'].includes(proposal.status)) return false;
    const active = state.proposals.find((item) => item.id === state.activeMainlineProposalId && item.status === 'adopted') || null;
    const decision = decideTideRailByPolicy(proposal, active, now);
    if (!decision) return false;
    const generation = get().beginAdjudication(id);
    return generation !== null && get().applyDecision(id, generation, decision);
  },
  deferProposal: (id, now = Date.now()) => {
    const state = get();
    const proposal = state.proposals.find((item) => item.id === id);
    if (!proposal || proposal.decision || ['completed', 'superseded'].includes(proposal.status)) return false;
    const decision: TideRailDecision = {
      verdict: 'defer',
      rationale: '使用者選擇稍後處理；保留提案與來源資料，不納入目前主線。',
      appliedRules: ['稍後處理不改變目前主線'],
      decidedBy: 'policy_engine',
      policyVersion: 'tiderail-policy-v1',
      confidence: 1,
      decidedAt: now,
    };
    const generation = get().beginAdjudication(id);
    return generation !== null && get().applyDecision(id, generation, decision);
  },
  skipProposal: (id, now = Date.now()) => {
    const state = get();
    const proposal = state.proposals.find((item) => item.id === id);
    if (!proposal || proposal.decision || ['completed', 'superseded'].includes(proposal.status)) return false;
    const decision: TideRailDecision = {
      verdict: 'reject',
      rationale: '使用者略過這項提案；保留歷史資料，不加入目前工作流程。',
      appliedRules: ['略過不刪除來源或歷史資料'],
      decidedBy: 'policy_engine',
      policyVersion: 'tiderail-policy-v1',
      confidence: 1,
      decidedAt: now,
    };
    const generation = get().beginAdjudication(id);
    return generation !== null && get().applyDecision(id, generation, decision);
  },
  beginAdjudication: (id) => {
    const proposal = get().proposals.find((item) => item.id === id);
    if (!proposal || proposal.decision || ['completed', 'superseded'].includes(proposal.status)) return null;
    const generation = (get().adjudicationGeneration[id] || 0) + 1;
    set((state) => ({ adjudicationGeneration: { ...state.adjudicationGeneration, [id]: generation }, proposals: state.proposals.map((item) => item.id === id ? { ...item, status: 'adjudicating', updatedAt: Date.now() } : item) }));
    return generation;
  },
  applyDecision: (id, generation, decision) => {
    const state = get();
    const proposal = state.proposals.find((item) => item.id === id);
    if (!proposal || proposal.decision || state.adjudicationGeneration[id] !== generation || !decision.appliedRules.length) return false;
    if (decision.verdict === 'adopt' && state.activeMainlineProposalId && state.activeMainlineProposalId !== id) return false;
    const status: TideRailProposalStatus = decision.verdict === 'adopt' ? 'adopted' : decision.verdict === 'reject' ? 'rejected' : decision.verdict === 'defer' ? 'deferred' : 'advisory_open';
    set({ proposals: state.proposals.map((item) => item.id === id ? { ...item, status, decision, started: decision.verdict === 'adopt' || item.started, updatedAt: decision.decidedAt } : item), activeMainlineProposalId: decision.verdict === 'adopt' ? id : state.activeMainlineProposalId, decisionLedger: [{ proposalId: id, decision }, ...state.decisionLedger].slice(0, 120) });
    return true;
  },
  cancelAdjudication: (id, generation) => set((state) => state.adjudicationGeneration[id] !== generation ? state : ({ proposals: state.proposals.map((item) => item.id === id && item.status === 'adjudicating' ? { ...item, status: 'advisory_open', updatedAt: Date.now() } : item) })),
  runPolicyAdjudication: (id, now = Date.now()) => {
    const proposal = get().proposals.find((item) => item.id === id);
    const active = get().proposals.find((item) => item.id === get().activeMainlineProposalId) || null;
    if (!proposal) return null;
    const decision = decideTideRailByPolicy(proposal, active, now);
    if (!decision) return null;
    const generation = get().beginAdjudication(id);
    if (generation === null || !get().applyDecision(id, generation, decision)) return null;
    return decision;
  },
  confirmProposalInterruption: (id, now = Date.now()) => {
    const state = get();
    const candidate = state.proposals.find((item) => item.id === id && item.decision?.verdict === 'require_interruption_contract');
    const active = state.proposals.find((item) => item.id === state.activeMainlineProposalId && item.status === 'adopted');
    if (!candidate || !active || !['P0','P1'].includes(candidate.priority)) return false;
    const contract = { proposalId: candidate.id, interruptedProposalId: active.id, reason: candidate.decision!.rationale, checkpoint: `${active.completedCriteria.length}/${active.acceptanceCriteria.length} criteria`, firstAction: candidate.firstAction, resumeWhen: '中斷提案完成全部驗收後立即返回', acceptance: candidate.acceptanceCriteria, createdAt: now };
    set({ activeMainlineProposalId: candidate.id, pausedProposalStack: [...state.pausedProposalStack, active.id], proposalInterruptionContracts: [contract, ...state.proposalInterruptionContracts], proposals: state.proposals.map((item) => item.id === active.id ? { ...item, status: 'paused_by_interrupt', updatedAt: now } : item.id === candidate.id ? { ...item, status: 'adopted', started: true, updatedAt: now } : item) });
    return true;
  },
  completeActiveProposal: (now = Date.now()) => {
    const state = get();
    const proposal = state.proposals.find((item) => item.id === state.activeMainlineProposalId);
    if (!proposal || proposal.acceptanceCriteria.some((criterion) => !proposal.completedCriteria.includes(criterion))) return false;
    const resumeId = state.pausedProposalStack.at(-1) || null;
    set({ activeMainlineProposalId: resumeId, pausedProposalStack: resumeId ? state.pausedProposalStack.slice(0,-1) : state.pausedProposalStack, proposals: state.proposals.map((item) => item.id === proposal.id ? { ...item, status: 'completed', updatedAt: now } : item.id === resumeId ? { ...item, status: 'adopted', updatedAt: now } : item) });
    return true;
  },
}), {
  name: 'lunartide-tiderail-v1',
  version: 3,
  partialize: (state) => ({
    mainlines: state.mainlines,
    activeMainlineId: state.activeMainlineId,
    driftItems: state.driftItems,
    interruptedStack: state.interruptedStack,
    sessionClosures: state.sessionClosures,
    proposals: state.proposals,
    activeMainlineProposalId: state.activeMainlineProposalId,
    decisionLedger: state.decisionLedger,
    adjudicationGeneration: state.adjudicationGeneration,
    proposalInterruptionContracts: state.proposalInterruptionContracts,
    pausedProposalStack: state.pausedProposalStack,
    migrationVersion: state.migrationVersion,
  }),
  migrate: (persisted: unknown) => {
    const old = (persisted || {}) as Record<string, unknown>;
    const migrated = Array.isArray(old.mainlines) ? { ...initialState, ...old, proposals: Array.isArray(old.proposals) ? old.proposals : [], activeMainlineProposalId: typeof old.activeMainlineProposalId === 'string' ? old.activeMainlineProposalId : null, migrationVersion: 3 } : initialState;
    const { isWindowOpen: _isWindowOpen, activeTab: _activeTab, ...persistedState } = migrated;
    return persistedState;
  },
}));

const activeMainlineCache = new WeakMap<object, TideRailMainline | null>();
export const selectActiveMainline = (state: TideRailState) => {
  if (activeMainlineCache.has(state)) return activeMainlineCache.get(state)!;
  const proposal = state.proposals.find((item) => item.id === state.activeMainlineProposalId && item.status === 'adopted');
  if (proposal) {
    const derived = {
    id: proposal.id, title: proposal.title, sourceType: proposal.sourceRefs[0]?.type === 'quest' ? 'quest' as const : 'manual' as const,
    sourceId: proposal.sourceRefs[0]?.id, status: 'active' as const, priority: proposal.priority,
    acceptanceCriteria: proposal.acceptanceCriteria.map((label, index) => ({ id: `${proposal.id}:criterion:${index}`, label, completed: proposal.completedCriteria.includes(label), required: true })),
    nextAction: proposal.firstAction, sourceRoute: proposal.sourceRoute, checkpoint: '', resumeNote: '', firstActionAfterResume: '', createdAt: new Date(proposal.createdAt).toISOString(), updatedAt: new Date(proposal.updatedAt).toISOString(),
    } satisfies TideRailMainline;
    activeMainlineCache.set(state, derived);
    return derived;
  }
  const legacy = state.mainlines.find((item) => item.id === state.activeMainlineId && item.status === 'active') || null;
  activeMainlineCache.set(state, legacy);
  return legacy;
};
export const selectOpenDriftCount = (state: TideRailState) => state.driftItems.filter((item) => item.status !== 'resolved').length;
