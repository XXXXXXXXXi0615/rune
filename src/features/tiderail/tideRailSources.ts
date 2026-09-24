import type { Quest } from '@/store/useQuestStore';
import type { IterationRecord, ReleaseNotice } from '@/config/releaseNotices';
import type { TideRailCategory, TideRailPriority, TideRailProposal } from '@/store/useTideRailStore';

const questPriority = (priority: Quest['priority']): TideRailPriority => priority === 'high' ? 'P1' : priority === 'low' ? 'P3' : 'P2';
const categoryFor = (text: string): TideRailCategory => /bug|修復|錯誤|白屏|阻塞/i.test(text) ? 'runtime_bug' : /驗收|測試|build|typescript/i.test(text) ? 'validation' : /文件|文案/i.test(text) ? 'documentation' : 'feature';

export function buildTideRailProposals(quests: Quest[], iterations: IterationRecord[], notices: ReleaseNotice[], now = Date.now()): TideRailProposal[] {
  const proposals: TideRailProposal[] = quests.filter((quest) => !['completed', 'archived', 'abandoned'].includes(quest.status)).map((quest) => ({
    id: `proposal:quest:${quest.id}`, projectId: 'lunartide', title: quest.title,
    summary: quest.description?.slice(0, 280) || `引用 TIDEQUEST「${quest.title}」；任務正文仍由 TIDEQUEST 保存。`,
    category: categoryFor(`${quest.title} ${quest.description || ''}`), priority: questPriority(quest.priority),
    sourceRefs: [{ type: 'quest', id: quest.id }], impact: quest.status === 'in_progress' ? '已開始工作，應優先完成驗收與封口。' : '完成後推進既有 TIDEQUEST 任務。',
    estimatedScope: quest.estimatedMinutes ? `約 ${quest.estimatedMinutes} 分鐘` : undefined, dependencies: [],
    acceptanceCriteria: quest.subtasks.length ? quest.subtasks.map((item) => item.title) : [`TIDEQUEST「${quest.title}」達成既有完成條件`],
    completedCriteria: quest.subtasks.filter((item) => item.completed).map((item) => item.title), firstAction: quest.subtasks.find((item) => !item.completed)?.title || `前往 TIDEQUEST 檢視「${quest.title}」`,
    sourceRoute: '/quests', started: quest.status === 'in_progress', status: 'advisory_open', createdAt: Date.parse(quest.createdAt) || now, updatedAt: Date.parse(quest.updatedAt) || now,
  }));
  const latest = [...iterations].sort((a, b) => b.completedAt - a.completedAt)[0];
  latest?.nextTasks.forEach((task, index) => proposals.push({ id: `proposal:iteration:${latest.id}:${index}`, projectId: 'lunartide', title: task, summary: `來自 ${latest.sprintLabel} 的建議下一步。`, category: categoryFor(task), priority: 'P2', sourceRefs: [{ type: 'iteration', id: latest.id }], impact: '延續既有迭代紀錄，不建立平行任務。', dependencies: [], acceptanceCriteria: [`完成「${task}」的明確驗收`], completedCriteria: [], firstAction: '先確認依賴與驗收範圍', sourceRoute: '/settings/about', started: false, status: 'advisory_open', createdAt: latest.completedAt, updatedAt: latest.completedAt }));
  notices.flatMap((notice) => notice.knownIssues.map((issue, index) => ({ notice, issue, index }))).forEach(({ notice, issue, index }) => proposals.push({ id: `proposal:bug:${notice.id}:${index}`, projectId: 'lunartide', title: issue, summary: `來自版本 ${notice.version} 的已知問題。`, category: 'runtime_bug', priority: 'P1', sourceRefs: [{ type: 'bug', id: `${notice.id}:${index}` }], impact: '可能影響既有核心流程，需先確認是否為真實 Runtime 阻塞。', dependencies: [], acceptanceCriteria: [`問題「${issue}」已修復並通過驗證`], completedCriteria: [], firstAction: '重現問題並保存錯誤證據', sourceRoute: '/settings/about', started: false, status: 'advisory_open', createdAt: notice.publishedAt, updatedAt: notice.publishedAt }));
  return proposals;
}
