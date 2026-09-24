import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { TeXBlockList } from '@/components/tex-composer/TeXBlockList';
import { TeXCodeOutput } from '@/components/tex-composer/TeXCodeOutput';
import { TeXPreview } from '@/components/tex-composer/TeXPreview';
import { TeXStylePanel } from '@/components/tex-composer/TeXStylePanel';
import { TeXTemplatePicker } from '@/components/tex-composer/TeXTemplatePicker';
import { generateLatex } from '@/features/tex-composer/generateLatex';
import { BUILTIN_TEX_TEMPLATES, instantiateTemplate } from '@/features/tex-composer/templates';
import { createBlock, newTeXId, type CompileTarget, type TeXBlock, type TeXTemplate } from '@/features/tex-composer/types';
import { useToastStore } from '@/store/useToastStore';
import '@/styles/tex-composer.css';

type Mode = 'guided' | 'latex';
type MobileTab = 'text' | 'style' | 'preview' | 'code';
type Draft = { blocks: TeXBlock[]; rawLatex: string; mode: Mode; selectedId?: string };
const DRAFT_KEY = 'lunartide_tex_composer_draft_v1';
const TEMPLATE_KEY = 'lunartide_tex_composer_templates_v1';

function buildRawDocument(rawLatex: string, target: CompileTarget): string {
  if (target === 'xelatex') {
    return `\\documentclass{ctexart}\n\\usepackage{amsmath}\n\\usepackage{xcolor}\n\\usepackage{graphicx}\n\\usepackage{xeCJK}\n\n\\begin{document}\n${rawLatex}\n\\end{document}`;
  }
  if (target === 'lualatex') {
    return `\\documentclass{article}\n\\usepackage{amsmath}\n\\usepackage{xcolor}\n\\usepackage{graphicx}\n\\usepackage{fontspec}\n\\usepackage{luatexja-fontspec}\n\n\\begin{document}\n${rawLatex}\n\\end{document}`;
  }
  return `\\documentclass{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amsmath}\n\\usepackage{xcolor}\n\\usepackage{graphicx}\n\n\\begin{document}\n${rawLatex}\n\\end{document}`;
}

function initialBlocks() { return instantiateTemplate(BUILTIN_TEX_TEMPLATES[0]); }
function readDraft(): Draft {
  try {
    const value = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null') as Partial<Draft> | null;
    const blocks = Array.isArray(value?.blocks) && value.blocks.length ? value.blocks : initialBlocks();
    return { blocks, rawLatex: typeof value?.rawLatex === 'string' ? value.rawLatex : '', mode: value?.mode === 'latex' ? 'latex' : 'guided', selectedId: value?.selectedId || blocks[0]?.id };
  } catch { const blocks = initialBlocks(); return { blocks, rawLatex: '', mode: 'guided', selectedId: blocks[0]?.id }; }
}
function readTemplates(): TeXTemplate[] {
  try { const value = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '[]'); return Array.isArray(value) ? value.filter((item) => item && Array.isArray(item.blocks)) : []; }
  catch { return []; }
}

export function TeXComposerPage() {
  const draft = useMemo(readDraft, []);
  const [blocks, setBlocks] = useState(draft.blocks);
  const [rawLatex, setRawLatex] = useState(draft.rawLatex);
  const [mode, setMode] = useState<Mode>(draft.mode);
  const [selectedId, setSelectedId] = useState(draft.selectedId);
  const [mobileTab, setMobileTab] = useState<MobileTab>('text');
  const [customTemplates, setCustomTemplates] = useState<TeXTemplate[]>(readTemplates);
  const [templateLocked, setTemplateLocked] = useState(false);
  const [confirmMode, setConfirmMode] = useState(false);
  const [history, setHistory] = useState<TeXBlock[][]>([]);
  const [future, setFuture] = useState<TeXBlock[][]>([]);
  const blocksRef = useRef(blocks);
  const showToast = useToastStore((state) => state.showToast);
  const generated = useMemo(() => generateLatex(blocks), [blocks]);
  const selected = blocks.find((block) => block.id === selectedId);

  useEffect(() => { localStorage.setItem(DRAFT_KEY, JSON.stringify({ blocks, rawLatex, mode, selectedId })); }, [blocks, mode, rawLatex, selectedId]);

  const commitBlocks = (next: TeXBlock[]) => {
    setHistory((items) => [...items.slice(-29), structuredClone(blocksRef.current)]);
    setFuture([]); blocksRef.current = next; setBlocks(next); setTemplateLocked(true);
    if (selectedId && !next.some((block) => block.id === selectedId)) setSelectedId(next[0]?.id);
  };
  const undo = () => { const previous = history.at(-1); if (!previous) return; setFuture((items) => [structuredClone(blocks), ...items].slice(0, 30)); setHistory((items) => items.slice(0, -1)); blocksRef.current = previous; setBlocks(previous); };
  const redo = () => { const next = future[0]; if (!next) return; setHistory((items) => [...items, structuredClone(blocks)].slice(-30)); setFuture((items) => items.slice(1)); blocksRef.current = next; setBlocks(next); };
  const switchMode = (next: Mode) => {
    if (next === mode) return;
    if (next === 'latex') { setRawLatex(rawLatex.trim() || generated.body); setMode('latex'); setMobileTab('text'); return; }
    if (rawLatex.trim() && rawLatex.trim() !== generated.body.trim()) setConfirmMode(true); else setMode('guided');
  };
  const applyTemplate = (template: TeXTemplate) => { const next = instantiateTemplate(template); setHistory((items) => [...items.slice(-29), structuredClone(blocks)]); setFuture([]); blocksRef.current = next; setBlocks(next); setSelectedId(next[0]?.id); setTemplateLocked(false); };
  const saveTemplate = (name: string) => { const template = { id: newTeXId(), name, createdAt: new Date().toISOString(), blocks: structuredClone(blocks) }; const next = [...customTemplates, template]; setCustomTemplates(next); localStorage.setItem(TEMPLATE_KEY, JSON.stringify(next)); showToast('模板已保存'); };
  const copy = async (value: string, label: string) => { try { await navigator.clipboard.writeText(value); showToast(label); } catch { showToast('複製失敗，請手動選擇代碼'); } };
  const download = (target: CompileTarget) => { const content = mode === 'latex' ? buildRawDocument(rawLatex, target) : generated.documents[target]; const blob = new Blob([content], { type: 'application/x-tex;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'lunartide-composition.tex'; link.click(); URL.revokeObjectURL(url); };
  const reset = () => { const next = [createBlock('text')]; setHistory((items) => [...items.slice(-29), structuredClone(blocks)]); setFuture([]); blocksRef.current = next; setBlocks(next); setRawLatex(''); setSelectedId(next[0].id); setTemplateLocked(false); setMode('guided'); };

  return <main className="tex-composer-page">
    <header className="tex-composer-header">
      <div className="tex-title-row"><Link to="/playroom" className="tex-back" aria-label="返回遊戲室"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg></Link><div><span className="tex-eyebrow">LUNARIS PLAYROOM · BETA</span><h1>TeX Composer</h1><p>把文字排成可複製的 LaTeX。</p></div></div>
      <div className="tex-header-actions"><button disabled={!history.length} onClick={undo}>撤銷</button><button disabled={!future.length} onClick={redo}>重做</button><button onClick={reset}>重置</button></div>
    </header>
    <div className="tex-mode-switch" role="tablist"><button className={mode === 'guided' ? 'active' : ''} onClick={() => switchMode('guided')}>引導模式</button><button className={mode === 'latex' ? 'active' : ''} onClick={() => switchMode('latex')}>LaTeX 模式</button></div>
    <p className="tex-beta-note">TeX Composer 仍在試驗中，複雜語法可能需要手動調整。</p>
    {mode === 'guided' && <TeXTemplatePicker templates={[...BUILTIN_TEX_TEMPLATES, ...customTemplates]} locked={templateLocked} onApply={applyTemplate} onSave={saveTemplate} />}
    <nav className="tex-mobile-tabs">{([['text', '文字'], ['style', '樣式'], ['preview', '預覽'], ['code', '代碼']] as const).map(([id, label]) => <button key={id} className={mobileTab === id ? 'active' : ''} onClick={() => setMobileTab(id)}>{label}</button>)}</nav>
    <div className="tex-workspace">
      <div className={`tex-cell tex-cell-text${mobileTab === 'text' ? ' active' : ''}`}>{mode === 'guided' ? <TeXBlockList blocks={blocks} selectedId={selectedId} onSelect={setSelectedId} onChange={commitBlocks} /> : <section className="tex-panel tex-raw-panel"><div className="tex-panel-head"><div><span>原始 LaTeX</span><small>手動模式</small></div></div><textarea value={rawLatex} onChange={(event) => setRawLatex(event.target.value)} spellCheck={false} placeholder={'\\[\n\\text{輸入 LaTeX}\n\\]'} /></section>}</div>
      <div className={`tex-cell tex-cell-preview${mobileTab === 'preview' ? ' active' : ''}`}><TeXPreview source={mode === 'latex' ? rawLatex : generated.body} onReturn={() => setMobileTab('text')} /></div>
      <div className={`tex-cell tex-cell-style${mobileTab === 'style' ? ' active' : ''}`}>{mode === 'guided' ? <TeXStylePanel block={selected} onChange={(next) => commitBlocks(blocks.map((block) => block.id === next.id ? next : block))} /> : <section className="tex-panel tex-style-panel"><div className="tex-panel-head"><div><span>LaTeX 模式</span><small>原始內容</small></div></div><div className="tex-raw-help">直接編輯代碼並即時預覽。切回引導模式時，不會靜默覆蓋手動內容。</div></section>}</div>
      <div className={`tex-cell tex-cell-code${mobileTab === 'code' ? ' active' : ''}`}><TeXCodeOutput body={mode === 'latex' ? rawLatex : generated.body} documents={mode === 'latex' ? { xelatex: buildRawDocument(rawLatex, 'xelatex'), lualatex: buildRawDocument(rawLatex, 'lualatex'), pdflatex: buildRawDocument(rawLatex, 'pdflatex') } : generated.documents} degradation={mode === 'guided' ? generated.degradation : []} onCopy={copy} onDownload={download} /></div>
    </div>
    {!!generated.errors.length && mode === 'guided' && <div className="tex-validation" role="status">{generated.errors.map((error) => <span key={error}>{error}</span>)}</div>}
    {confirmMode && <div className="tex-confirm-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setConfirmMode(false)}><section className="tex-confirm-sheet" role="dialog" aria-modal="true"><h2>手動 LaTeX 無法完整還原為可視化區塊。</h2><p>引導模式內容仍然保留。選擇覆蓋後，當前手動代碼不會轉換成區塊。</p><div><button onClick={() => setConfirmMode(false)}>保留 LaTeX 模式</button><button className="primary" onClick={() => { setMode('guided'); setConfirmMode(false); }}>使用引導模式內容覆蓋</button></div></section></div>}
  </main>;
}
