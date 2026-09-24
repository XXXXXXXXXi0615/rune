import type { ContextSnapshot, ContextBudget } from '@/ai/contextPreview';
import { BUDGET_TOTAL } from '@/ai/contextPreview';

interface ContextDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  snapshot: ContextSnapshot;
}

function BudgetBar({ budget }: { budget: ContextBudget }) {
  const pct = Math.min(100, Math.round((budget.totalChars / BUDGET_TOTAL) * 100));
  const refPct = budget.totalChars > 0 ? Math.max(2, Math.round((budget.referenceChars / BUDGET_TOTAL) * 100)) : 0;
  const memPct = budget.totalChars > 0 ? Math.max(2, Math.round((budget.memoryChars / BUDGET_TOTAL) * 100)) : 0;
  const autoPct = budget.totalChars > 0 ? Math.max(2, Math.round((budget.autoChars / BUDGET_TOTAL) * 100)) : 0;

  return (
    <div className="ctx-budget-section">
      <div className="ctx-budget-header">
        <span className="ctx-section-label">Context Budget</span>
        <span className="ctx-budget-total">{budget.totalChars} / {BUDGET_TOTAL} chars</span>
      </div>
      {/* Stacked bar */}
      <div className="ctx-budget-bar">
        {budget.referenceChars > 0 && (
          <div className="ctx-budget-seg ctx-budget-ref" style={{ width: `${refPct}%` }} title={`Reference ${budget.referenceChars}c`} />
        )}
        {budget.memoryChars > 0 && (
          <div className="ctx-budget-seg ctx-budget-mem" style={{ width: `${memPct}%` }} title={`Memory ${budget.memoryChars}c`} />
        )}
        {budget.autoChars > 0 && (
          <div className="ctx-budget-seg ctx-budget-auto" style={{ width: `${autoPct}%` }} title={`Auto ${budget.autoChars}c`} />
        )}
        <div className="ctx-budget-seg ctx-budget-free" style={{ flex: 1 }} title="Free space" />
      </div>
      {/* Legend */}
      <div className="ctx-budget-legend">
        <span className="ctx-budget-legend-item">
          <span className="ctx-budget-dot ctx-budget-dot-ref" />
          引用 {budget.referenceChars}c
        </span>
        <span className="ctx-budget-legend-item">
          <span className="ctx-budget-dot ctx-budget-dot-mem" />
          記憶 {budget.memoryChars}c
        </span>
        <span className="ctx-budget-legend-item">
          <span className="ctx-budget-dot ctx-budget-dot-auto" />
          自動 {budget.autoChars}c
        </span>
      </div>
      <div className="ctx-budget-pct">{pct}%</div>
    </div>
  );
}

function SectionHeader({ title, order, items }: { title: string; order: number; items: unknown[] }) {
  return (
    <div className="ctx-section-header">
      <div className="ctx-section-title-row">
        <span className="ctx-priority-badge">{order}</span>
        <span className="ctx-section-title">{title}</span>
      </div>
      <span className="ctx-section-count">{items.length} 筆</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="ctx-empty">
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      <p className="ctx-empty-text">尚未加入任何上下文</p>
      <p className="ctx-empty-hint">點擊「加入上下文」開始選擇</p>
    </div>
  );
}

export function ContextDrawer({ isOpen, onClose, snapshot }: ContextDrawerProps) {
  if (!isOpen) return null;

  const references = snapshot.items.filter((i) => i.category === 'reference');
  const memories = snapshot.items.filter((i) => i.category === 'memory');
  const autoItems = snapshot.items.filter((i) => i.category === 'auto');
  const hasAny = snapshot.items.length > 0;

  return (
    <div className="quick-sheet-overlay active ctx-drawer-overlay" onClick={onClose}>
      <div className="quick-sheet ctx-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="quick-sheet-handle" />
        <div className="quick-sheet-head ctx-drawer-head">
          <div>
            <span className="quick-sheet-title">上下文</span>
            <span className="ctx-drawer-subtitle">Prompt 注入優先級與預算概覽</span>
          </div>
        </div>

        <div className="quick-sheet-body ctx-drawer-body">
          {!hasAny ? (
            <EmptyState />
          ) : (
            <>
              {/* Priority visualization hint */}
              <div className="ctx-priority-hint">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
                </svg>
                <span>Prompt 注入順序：1. Reference → 2. Memory → 3. Auto</span>
              </div>

              {/* References */}
              <div className="ctx-section">
                <SectionHeader title="References" order={1} items={references} />
                {references.length > 0 ? (
                  <div className="ctx-item-list">
                    {references.map((item) => (
                      <div key={item.id} className="ctx-item-row">
                        <span className="ctx-item-icon">{item.icon}</span>
                        <span className="ctx-item-text">
                          <span className="ctx-item-label">{item.label}</span>
                          <span className="ctx-item-detail">{item.detail}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="ctx-section-empty">尚無引用資料</p>
                )}
              </div>

              {/* Memory */}
              <div className="ctx-section">
                <SectionHeader title="Memory Context" order={2} items={memories} />
                {memories.length > 0 ? (
                  <div className="ctx-item-list">
                    {memories.map((item) => (
                      <div key={item.id} className="ctx-item-row">
                        <span className="ctx-item-icon">{item.icon}</span>
                        <span className="ctx-item-text">
                          <span className="ctx-item-label">{item.label}</span>
                          <span className="ctx-item-detail">{item.detail}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="ctx-section-empty">尚無相關記憶</p>
                )}
              </div>

              {/* Auto */}
              <div className="ctx-section">
                <SectionHeader title="Auto Context" order={3} items={autoItems} />
                {autoItems.length > 0 ? (
                  <div className="ctx-item-list">
                    {autoItems.map((item) => (
                      <div key={item.id} className="ctx-item-row">
                        <span className="ctx-item-icon">{item.icon}</span>
                        <span className="ctx-item-text">
                          <span className="ctx-item-label">{item.label}</span>
                          <span className="ctx-item-detail">{item.detail}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="ctx-section-empty">尚無可用自動上下文</p>
                )}
              </div>
            </>
          )}

          {/* Budget Monitor — always visible */}
          <BudgetBar budget={snapshot.budget} />
        </div>
      </div>
    </div>
  );
}
