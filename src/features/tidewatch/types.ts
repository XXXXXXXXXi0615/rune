/**
 * TIDEWATCH Phase 1A — canonical type definitions.
 *
 * Writing telemetry records how much was written, never what was written.
 * Raw text is never persisted in the TIDEWATCH database.
 */

// ---------------------------------------------------------------------------
// Writing telemetry
// ---------------------------------------------------------------------------

export type WritingActor = 'user' | 'agent';

export type WritingSurface =
  | 'chat'
  | 'moments'
  | 'calendar'
  | 'moonread'
  | 'tidequest'
  | 'life-ledger'
  | string;

export interface WritingTelemetryEvent {
  id: string;
  timestamp: number;
  actor: WritingActor;
  surface: WritingSurface;
  inputChars: number;
  committedChars: number;
  sessionId?: string;
  sourceId?: string;
}

// ---------------------------------------------------------------------------
// Check-in
// ---------------------------------------------------------------------------

export type CheckInActivity =
  | 'working'
  | 'studying'
  | 'exercising'
  | 'relaxing'
  | 'socialising'
  | 'creating'
  | 'resting'
  | 'commuting'
  | string;

export interface CheckIn {
  id: string;
  createdAt: number;
  activity: CheckInActivity;
  mood?: number;     // 1-5
  energy?: number;   // 1-5
  focus?: number;    // 1-5
  note?: string;
}

// ---------------------------------------------------------------------------
// Activity Ledger
// ---------------------------------------------------------------------------

export type ActivityEventType =
  | 'checkin'
  | 'writing'
  | 'writing_milestone'
  | 'quest_nudge'
  | 'quest_start'
  | 'quest_complete'
  | 'note'
  | AgentTelemetryKind;

export type AgentSourceKind = 'codex' | 'lunartide' | 'external';

export type AgentTelemetryKind =
  | 'run_start'
  | 'run_end'
  | 'tool_call'
  | 'command'
  | 'file_change'
  | 'test'
  | 'result'
  | 'error';

export interface AgentTelemetryMetadata {
  provider?: string;
  model?: string;
  toolName?: string;
  filePath?: string;
  exitCode?: number;
  durationMs?: number;
  testPassed?: number;
  testFailed?: number;
  resultSummary?: string;
}

export interface NormalizedAgentTelemetryEvent {
  id: string;
  timestamp: number;
  sourceId: string;
  sourceKind: AgentSourceKind;
  agentId?: string;
  sessionId?: string;
  runId?: string;
  kind: AgentTelemetryKind;
  title: string;
  metadata?: AgentTelemetryMetadata;
}

export interface ActivityEvent {
  id: string;
  timestamp: number;
  type: ActivityEventType;
  sourceId?: string;
  sourceKind?: AgentSourceKind;
  agentId?: string;
  sessionId?: string;
  runId?: string;
  title?: string;
  metadata?: {
    surface?: WritingSurface;
    chars?: number;
    scope?: MilestoneScope;
    questId?: string;
    questTitle?: string;
    milestoneName?: string;
    milestoneThreshold?: number;
    notePreview?: string;
    provider?: string;
    model?: string;
    toolName?: string;
    filePath?: string;
    exitCode?: number;
    durationMs?: number;
    testPassed?: number;
    testFailed?: number;
    resultSummary?: string;
  };
}

// ---------------------------------------------------------------------------
// Rune Review Gate / Consequences
// ---------------------------------------------------------------------------

export type ReviewRequestType = 'defer' | 'extend' | 'reduce' | 'pause' | 'abandon';
export type ReviewDecisionKind = 'approved' | 'conditional' | 'rejected';
export type ReviewTone = 'restrained' | 'strict' | 'master';
export type ReviewDifficultyMode = 'fixed' | 'adaptive';

export interface ReviewDecision {
  decision: ReviewDecisionKind;
  reasonCode: string;
  message: string;
  conditions?: string[];
}

export interface ReviewRecord {
  id: string;
  questId: string;
  questTitleSnapshot: string;
  requestType: ReviewRequestType;
  reasonSnapshot: string;
  recoveryPlanSnapshot?: string;
  nextActionSnapshot?: string;
  resumeAtSnapshot?: string;
  difficultySnapshot: number;
  decision: ReviewDecision;
  conditionsAcceptedAt?: number;
  overrideReason?: 'emergency' | 'health' | 'accidental_configuration' | 'other';
  createdAt: number;
}

export type ConsequenceLifecycle = 'pending' | 'revealed' | 'active' | 'fulfilled';
export type ConsequenceExecutionType = 'manual' | 'timer';

export interface ConsequencePoolItem {
  id: string;
  title: string;
  enabled: boolean;
  intensity: number;
  executionType: ConsequenceExecutionType;
  durationMinutes?: number;
  weight?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ConsequenceSelectedSnapshot {
  title: string;
  intensity: number;
  executionType: ConsequenceExecutionType;
  durationMinutes?: number;
}

export interface TidewatchConsequencePreferences {
  intensity: number;
  pool: ConsequencePoolItem[];
}

export interface TidewatchConsequence {
  id: string;
  sourceEventId: string;
  questId: string;
  questTitleSnapshot: string;
  lifecycle: ConsequenceLifecycle;
  selectedItemId?: string;
  selectedItemSnapshot?: ConsequenceSelectedSnapshot;
  selectedAt?: number;
  executionStartedAt?: number;
  timerSessionId?: string;
  fulfilledAt?: number;
  perceivedIntensity?: 'too_light' | 'right' | 'too_heavy';
  createdAt: number;
  updatedAt: number;
  safetyOverride?: ReviewRecord['overrideReason'];
}

export interface TidewatchReviewPreferences {
  baseDifficulty: number;
  baseDifficultyByType?: Partial<Record<ReviewRequestType, number>>;
  difficultyMode: ReviewDifficultyMode;
  tone: ReviewTone;
  useBaseDifficultyByDate?: Record<string, true>;
}

// ---------------------------------------------------------------------------
// Milestones (Tidemarks)
// ---------------------------------------------------------------------------

export type MilestoneScope = 'user' | 'agent' | 'combined';

export interface MilestoneDefinition {
  name: string;
  scope: MilestoneScope;
  threshold: number;
}

export interface Milestone extends MilestoneDefinition {
  id: string;
  reachedAt?: number;
  userCountAtMoment?: number;
  agentCountAtMoment?: number;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export interface PeriodStats {
  userInput: number;
  userCommitted: number;
  agentCommitted: number;
  combinedCommitted: number;
}

export interface SurfaceBreakdown {
  surface: string;
  chars: number;
  percentage: number;
}

export interface DailyBreakdown {
  date: string; // YYYY-MM-DD
  userChars: number;
  agentChars: number;
  combinedChars: number;
}

export interface WeeklyWordTrace {
  userChars: number;
  agentChars: number;
  combinedChars: number;
  dailyBreakdown: DailyBreakdown[];
  mostActiveDay: string | null;
  surfaceBreakdown: SurfaceBreakdown[];
  changeVsPreviousWeek: number; // percentage change
}

// ---------------------------------------------------------------------------
// Rune Bridge
// ---------------------------------------------------------------------------

export type RuneIntent =
  | 'idle'
  | 'focused'
  | 'typing'
  | 'paused'
  | 'session-proud'
  | 'daily-proud'
  | 'milestone-received'
  | 'milestone-pleased'
  | 'curious';

export interface RuneBridgeInput {
  isFocused: boolean;
  isTyping: boolean;
  typingPaused: boolean;
  currentSessionChars: number;
  todayUserChars: number;
  newMilestone: boolean;
}

export interface RuneBridgeOutput {
  intent: RuneIntent;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Authoring surface registry
// ---------------------------------------------------------------------------

export type AuthoringSurfaceType = WritingSurface;

export interface RegisteredSurface {
  surface: AuthoringSurfaceType;
  sourceId?: string;
}
