import { useState } from 'react';
import type { ParsedExpense } from '@/utils/expenseParser';

interface ChatLedgerConfirmCardProps {
  expense: ParsedExpense;
  onConfirm: (expense: ParsedExpense) => void;
  onDismiss: () => void;
}

const CATEGORY_OPTIONS: ParsedExpense['category'][] = ['生活', '飲食', '工作', '學習', '娛樂', 'AI', '交通', '醫療', '其他'];
const MOOD_OPTIONS: ParsedExpense['mood'][] = ['必要', '衝動', '安慰', '後悔', '開心', '普通'];

export function ChatLedgerConfirmCard({ expense, onConfirm, onDismiss }: ChatLedgerConfirmCardProps) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(expense.amount);
  const [title, setTitle] = useState(expense.title);
  const [category, setCategory] = useState(expense.category);
  const [mood, setMood] = useState(expense.mood);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  if (editing) {
    return (
      <div className="ledger-confirm-card">
        <div className="ledger-confirm-head">
          <span>修改記錄</span>
          <button onClick={() => setEditing(false)} aria-label="取消修改">✕</button>
        </div>
        <div className="ledger-confirm-fields">
          <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} placeholder="金額" />
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="品項" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <div className="ledger-chip-row">
            {CATEGORY_OPTIONS.map((c) => (
              <button key={c} className={`ledger-chip ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>{c}</button>
            ))}
          </div>
          <div className="ledger-chip-row">
            {MOOD_OPTIONS.map((m) => (
              <button key={m} className={`ledger-chip ${mood === m ? 'active' : ''}`} onClick={() => setMood(m)}>{m}</button>
            ))}
          </div>
        </div>
        <div className="ledger-confirm-actions">
          <button className="ledger-btn-ghost" onClick={() => setEditing(false)}>取消</button>
          <button className="ledger-btn-primary" onClick={() => { onConfirm({ ...expense, amount, title, category, mood, date }); }}>儲存</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ledger-confirm-card">
      <div className="ledger-confirm-head">
        <span>記帳確認</span>
        <button onClick={onDismiss} aria-label="關閉">✕</button>
      </div>
      <div className="ledger-confirm-body">
        <div className="ledger-confirm-row">
          <span className="ledger-confirm-amount">{expense.amount} 元</span>
          <span className="ledger-confirm-title">{expense.title}</span>
        </div>
        <div className="ledger-confirm-meta">
          <span className="ledger-badge">{expense.category}</span>
          <span className="ledger-badge ledger-badge-mood">{expense.mood}</span>
        </div>
        {expense.note && <p className="ledger-confirm-note">「{expense.note}」</p>}
        <span className="ledger-confirm-date">{new Date().toLocaleDateString('zh-TW')}</span>
      </div>
      <p className="ledger-privacy-hint">不會自動寫入記憶庫 · 僅供帳簿參考</p>
      <div className="ledger-confirm-actions">
        <button className="ledger-btn-ghost" onClick={onDismiss}>不要記</button>
        <button className="ledger-btn-ghost" onClick={() => setEditing(true)}>修改</button>
        <button className="ledger-btn-primary" onClick={() => onConfirm(expense)}>確認記錄</button>
      </div>
    </div>
  );
}
