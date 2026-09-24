import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAssetBlobUrl } from '@/hooks/useAssetBlobUrl';
import type { LifeLedgerEntry, LifeLedgerSource } from '@/features/lifeLedger/domain';
import { formatMinorAmount, loadLifeLedgerReadModel, type LifeLedgerReadModel } from '@/features/lifeLedger/readModel';
import './LifeLedgerPage.css';

type Section = 'overview' | 'records' | 'items' | 'diet';
type DietView = 'food' | 'cooking' | 'recipes' | 'receipts';

const sectionLabels: Record<Section, string> = { overview: '總覽', records: '記錄', items: '物品', diet: '飲食' };
const typeLabels = { food: '飲食', item: '物品', expense: '支出', income: '收入' } as const;
const mealLabels = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '點心' } as const;

function Provenance({ id, source, assetStatus }: { id: string; source: LifeLedgerSource; assetStatus?: string }) {
  if (!import.meta.env.DEV) return null;
  return <small className="ll-provenance">{id} · {source.owner}/{source.legacyId} · mv{source.migrationVersion}{assetStatus ? ` · asset:${assetStatus}` : ''}</small>;
}

function AssetImage({ entry }: { entry: { title: string; assetId?: string; assetMigration?: { status: string } } }) {
  const url = useAssetBlobUrl(entry.assetId);
  if (!entry.assetId) return null;
  return (
    <div className="ll-asset" data-asset-id={entry.assetId} data-asset-status={url ? 'resolved' : entry.assetMigration?.status ?? 'unknown'}>
      {url ? <img src={url} alt={`${entry.title}照片`} /> : import.meta.env.DEV ? <span>資產尚未解析</span> : null}
    </div>
  );
}

function Empty({ children }: { children: string }) { return <div className="ll-empty">{children}</div>; }
function DateText({ value }: { value: string }) { return <time dateTime={value}>{new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium', timeStyle: value.includes('T') ? 'short' : undefined }).format(new Date(value))}</time>; }

function WriteBridge({ label, route, returnTo }: { label: string; route: string; returnTo: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="ll-bridge-btn"
      onClick={() => navigate(`${route}?returnTo=${encodeURIComponent(returnTo)}`)}
    >
      {label}
    </button>
  );
}

function EntryCard({ entry }: { entry: LifeLedgerEntry }) {
  return (
    <article className="ll-card ll-entry" data-entry-type={entry.type} data-entry-id={entry.id}>
      <header><span className={`ll-kind ll-kind--${entry.type}`}>{typeLabels[entry.type]}</span><DateText value={entry.occurredAt} /></header>
      <h3>{entry.title}</h3>
      {entry.food && <p>{mealLabels[entry.food.mealType]} · {entry.food.calories ?? '—'} kcal · 蛋白質 {entry.food.protein ?? '—'}g · 碳水 {entry.food.carbs ?? '—'}g · 脂肪 {entry.food.fat ?? '—'}g · 水分 {entry.food.water ?? '—'}ml</p>}
      {entry.item && <p>{entry.item.category} · 狀態 {entry.item.lifecycleState} · 使用 {entry.item.usageDays} 天</p>}
      {entry.monetary && <p className="ll-money" data-amount-minor={entry.monetary.amountMinor} data-currency={entry.monetary.currency}>{formatMinorAmount(entry.monetary.amountMinor, entry.monetary.currency)}</p>}
      <AssetImage entry={entry} />
      <Provenance id={entry.id} source={entry.source} assetStatus={entry.assetMigration?.status} />
    </article>
  );
}

export function LifeLedgerPage() {
  const [model, setModel] = useState<LifeLedgerReadModel>();
  const [error, setError] = useState(false);
  const [searchParams] = useSearchParams();
  const [section, setSection] = useState<Section>((searchParams.get('section') as Section) || 'overview');
  const [dietView, setDietView] = useState<DietView>('food');
  useEffect(() => { let current = true; void loadLifeLedgerReadModel().then((next) => { if (current) setModel(next); }).catch(() => { if (current) setError(true); }); return () => { current = false; }; }, []);
  const lifecycleByItem = useMemo(() => new Map(model?.itemEntries.map((item) => [item.id, model.lifecycleEvents.filter((event) => event.itemEntryId === item.id)]) ?? []), [model]);

  if (error) return <main className="life-ledger-page"><Empty>Life Ledger 暫時無法讀取</Empty></main>;
  if (!model) return <main className="life-ledger-page" aria-busy="true">正在讀取 Life Ledger…</main>;

  const counts = [
    ['飲食紀錄', model.foodEntries.length], ['料理紀錄', model.cookingLogs.length], ['物品紀錄', model.itemEntries.length],
    ['帳務紀錄', model.financeEntries.length], ['食譜', model.recipes.length], ['收據', model.receipts.length], ['生命週期', model.lifecycleEvents.length],
  ] as const;

  return (
    <main className="life-ledger-page" data-testid="life-ledger-page">
      <header className="ll-header"><div><span>生活賬本</span><h1>生活帳本</h1><p>物品 · 飲食 · 花銷 · 生活記錄</p></div>{import.meta.env.DEV && <small>Life Ledger v2<br />Migration {model.migrationHealth?.status ?? 'not run'}</small>}</header>
      <nav className="ll-tabs" aria-label="生活帳本區段">{(Object.keys(sectionLabels) as Section[]).map((key) => <button key={key} className={section === key ? 'is-active' : ''} aria-current={section === key ? 'page' : undefined} onClick={() => setSection(key)}>{sectionLabels[key]}</button>)}</nav>

      {section === 'overview' && <section aria-labelledby="ll-overview-title"><h2 id="ll-overview-title">資料總覽</h2><div className="ll-counts">{counts.map(([label, count]) => <article key={label}><strong>{count}</strong><span>{label}</span></article>)}</div><div className="ll-bridge-group"><h3>快速操作</h3><div className="ll-bridge-row"><WriteBridge label="加入物品" route="/objects" returnTo="/life-ledger?section=items" /><WriteBridge label="記錄支出" route="/ledger" returnTo="/life-ledger?section=records" /></div></div></section>}
      {section === 'records' && <section aria-labelledby="ll-records-title"><h2 id="ll-records-title">全部記錄</h2>{model.entries.length ? <div className="ll-list">{model.entries.map((entry) => <EntryCard key={entry.id} entry={entry} />)}</div> : <Empty>還沒有記錄</Empty>}</section>}
      {section === 'items' && <section aria-labelledby="ll-items-title"><h2 id="ll-items-title">物品與生命週期</h2>{model.itemEntries.length ? <div className="ll-list">{model.itemEntries.map((entry) => <article className="ll-card" key={entry.id}><EntryCard entry={entry} /><ol className="ll-lifecycle">{lifecycleByItem.get(entry.id)?.map((event) => <li key={event.id} data-sequence={event.sequence}><span>{event.from ? `${event.from} → ` : ''}{event.to}</span><DateText value={event.createdAt} /><p>{event.reason}{event.note ? ` · ${event.note}` : ''}</p><Provenance id={event.id} source={event.source} /></li>)}</ol></article>)}</div> : <Empty>還沒有物品紀錄</Empty>}</section>}
      {section === 'diet' && <section aria-labelledby="ll-diet-title"><h2 id="ll-diet-title">飲食核對</h2><nav className="ll-subtabs" aria-label="飲食資料類型">{(['food', 'cooking', 'recipes', 'receipts'] as DietView[]).map((key) => <button key={key} className={dietView === key ? 'is-active' : ''} onClick={() => setDietView(key)}>{{ food: '飲食', cooking: '料理', recipes: '食譜', receipts: '收據' }[key]}</button>)}</nav>
        {dietView === 'food' && <><div className="ll-nutrition" data-testid="nutrition-totals">{Object.entries(model.nutritionTotals).map(([key, value]) => <span key={key}>{key} <strong>{value}</strong></span>)}</div>{model.foodEntries.length ? <div className="ll-list">{model.foodEntries.map((entry) => <EntryCard key={entry.id} entry={entry} />)}</div> : <Empty>還沒有飲食紀錄</Empty>}</>}
        {dietView === 'cooking' && (model.cookingLogs.length ? <div className="ll-list">{model.cookingLogs.map((log) => <article className="ll-card" key={log.id} data-cooking-id={log.id}><header><h3>{log.title}</h3><DateText value={log.cookedAt} /></header><p>{mealLabels[log.mealType]} · 建立 {log.cookedAt} · 更新 {log.updatedAt}</p><p>食材：{log.ingredients?.join('、') || '—'}</p><p>步驟：{log.steps?.join(' → ') || '—'}</p><p>備註：{log.notes || '—'} · 標籤：{log.tags?.join('、') || '—'}</p><p>儲存為食譜：{log.saveAsRecipe ? '是' : '否'} · 食譜參照：{log.recipeId || '—'}</p><AssetImage entry={log} /><Provenance id={log.id} source={log.source} assetStatus={log.assetMigration?.status} /></article>)}</div> : <Empty>還沒有料理紀錄</Empty>)}
        {dietView === 'recipes' && (model.recipes.length ? <div className="ll-list">{model.recipes.map((recipe) => <article className="ll-card" key={recipe.id} data-recipe-id={recipe.id}><h3>{recipe.title}</h3><p>{recipe.category} · {recipe.ingredients.join('、')}</p><p>{recipe.steps.join(' → ')}</p><AssetImage entry={recipe} /><Provenance id={recipe.id} source={recipe.source} assetStatus={recipe.assetMigration?.status} /></article>)}</div> : <Empty>還沒有食譜</Empty>)}
        {dietView === 'receipts' && (model.receipts.length ? <div className="ll-list">{model.receipts.map((receipt) => <article className="ll-card" key={receipt.id} data-receipt-id={receipt.id}><header><h3>{receipt.date} 收據</h3><span>{receipt.mealEntryIds.length} 筆飲食</span></header><p>飲食參照：{receipt.mealEntryIds.join('、')}</p><p>{Object.entries(receipt.totals).map(([key, value]) => `${key} ${value}`).join(' · ')}</p><Provenance id={receipt.id} source={receipt.source} /></article>)}</div> : <Empty>還沒有收據</Empty>)}</section>}
    </main>
  );
}
