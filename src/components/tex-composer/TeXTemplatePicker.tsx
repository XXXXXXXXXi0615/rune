import { useState } from 'react';
import type { TeXTemplate } from '@/features/tex-composer/types';

export function TeXTemplatePicker({ templates, locked, onApply, onSave }: { templates: TeXTemplate[]; locked: boolean; onApply: (template: TeXTemplate) => void; onSave: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <section className="tex-template-strip" aria-label="模板">
      <div className="tex-template-scroll">{templates.map((template) => <button type="button" key={template.id} disabled={locked} onClick={() => onApply(template)}><span>{template.name}</span><small>{template.builtin ? '内置' : '我的模板'}</small></button>)}</div>
      <div className="tex-template-save"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="模板名称" /><button type="button" disabled={!name.trim()} onClick={() => { onSave(name.trim()); setName(''); }}>保存为模板</button></div>
      {locked && <small className="tex-template-lock">内容已修改；重置后可再次套用模板，避免无提示覆盖。</small>}
    </section>
  );
}
