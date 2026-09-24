import { createBlock, type TeXBlock, type TeXBlockType } from '@/features/tex-composer/types';

const TYPES: { type: TeXBlockType; label: string }[] = [
  { type: 'text', label: '文字' }, { type: 'annotated', label: '双语注释' }, { type: 'heading', label: '标题' },
  { type: 'colorbox', label: '色块' }, { type: 'fcolorbox', label: '边框色块' }, { type: 'rule', label: '分隔线' },
  { type: 'space', label: '间距' }, { type: 'columns', label: '双栏' }, { type: 'raw', label: '原始 LaTeX' },
];

export function TeXBlockList({ blocks, selectedId, onSelect, onChange }: {
  blocks: TeXBlock[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onChange: (blocks: TeXBlock[]) => void;
}) {
  const update = (id: string, patch: Partial<TeXBlock>) => onChange(blocks.map((block) => block.id === id ? { ...block, ...patch } : block));
  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <section className="tex-panel tex-editor-panel">
      <div className="tex-panel-head"><div><span>区块</span><small>{blocks.length} 个</small></div><select aria-label="新增区块" value="" onChange={(event) => { if (!event.target.value) return; const block = createBlock(event.target.value as TeXBlockType, event.target.value === 'annotated' ? 'English' : '新文字'); if (block.type === 'annotated') block.annotation = '注释'; if (block.type === 'columns') block.children = [createBlock('colorbox', '左侧'), createBlock('colorbox', '右侧')]; onChange([...blocks, block]); onSelect(block.id); }}><option value="">＋ 新增</option>{TYPES.map((item) => <option key={item.type} value={item.type}>{item.label}</option>)}</select></div>
      <div className="tex-block-list">
        {blocks.map((block, index) => (
          <article key={block.id} className={`tex-block-card${selectedId === block.id ? ' is-selected' : ''}`} draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', String(index))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => move(Number(event.dataTransfer.getData('text/plain')), index)} onClick={() => onSelect(block.id)}>
            <header><button type="button" className="tex-drag" aria-label="拖动排序"><svg viewBox="0 0 24 24"><path d="M8 7h8M8 12h8M8 17h8" /></svg></button><strong>{TYPES.find((item) => item.type === block.type)?.label}</strong><span>{index + 1}</span></header>
            {block.type !== 'rule' && block.type !== 'space' && block.type !== 'columns' && <textarea value={block.text} onChange={(event) => update(block.id, { text: event.target.value })} placeholder={block.type === 'raw' ? '\\text{LaTeX}' : '输入文字'} />}
            {block.type === 'annotated' && <input value={block.annotation || ''} onChange={(event) => update(block.id, { annotation: event.target.value })} placeholder="注释" />}
            {block.type === 'columns' && <div className="tex-column-edit">{(block.children || []).slice(0, 2).map((child, childIndex) => <input key={child.id} value={child.text} onChange={(event) => update(block.id, { children: (block.children || []).map((item) => item.id === child.id ? { ...item, text: event.target.value } : item) })} placeholder={childIndex ? '右侧内容' : '左侧内容'} />)}</div>}
            <footer><button type="button" onClick={(event) => { event.stopPropagation(); const copy = structuredClone(block); copy.id = crypto.randomUUID(); onChange([...blocks.slice(0, index + 1), copy, ...blocks.slice(index + 1)]); }}>复制</button><button type="button" className="is-danger" onClick={(event) => { event.stopPropagation(); onChange(blocks.filter((item) => item.id !== block.id)); }}>删除</button></footer>
          </article>
        ))}
      </div>
    </section>
  );
}
