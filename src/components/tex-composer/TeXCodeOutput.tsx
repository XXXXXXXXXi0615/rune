import { useState } from 'react';
import { COMPILE_TARGETS, type CompileTarget, type CompileTargetOption } from '@/features/tex-composer/types';

export function TeXCodeOutput({ body, documents, degradation, onCopy, onDownload }: {
  body: string;
  documents: Record<CompileTarget, string>;
  degradation: string[];
  onCopy: (value: string, label: string) => void;
  onDownload: (target: CompileTarget) => void;
}) {
  const [tab, setTab] = useState<'body' | 'document'>('body');
  const [target, setTarget] = useState<CompileTarget>('xelatex');
  const value = tab === 'body' ? body : documents[target];
  const selectedOption = COMPILE_TARGETS.find((t) => t.value === target) as CompileTargetOption;
  return (
    <section className="tex-panel tex-code-panel">
      <div className="tex-panel-head tex-code-head">
        <div className="tex-code-tabs">
          <button type="button" className={tab === 'body' ? 'active' : ''} onClick={() => setTab('body')}>网页预览代码</button>
          <button type="button" className={tab === 'document' ? 'active' : ''} onClick={() => setTab('document')}>完整 LaTeX 文档</button>
        </div>
        <div className="tex-code-actions">
          <select className="tex-compile-target-select" value={target} onChange={(e) => setTarget(e.target.value as CompileTarget)} aria-label="编译目标">
            {COMPILE_TARGETS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button type="button" onClick={() => onCopy(value, tab === 'body' ? 'LaTeX 已复制' : `${selectedOption.label} 文档已复制`)}>复制</button>
          <button type="button" onClick={() => onDownload(target)}>下载 .tex</button>
        </div>
      </div>
      <pre><code>{value || '% 内容为空'}</code></pre>
      {tab === 'document' && target === 'pdflatex' && <p className="tex-compile-note">当前为 pdfLaTeX 模板，不支持中文。含中文时请切换到 XeLaTeX 或 LuaLaTeX。</p>}
      {tab === 'document' && target !== 'pdflatex' && <p className="tex-compile-note">含中文时推荐使用 {selectedOption.label} 编译，并按环境配置 CJK 字体。</p>}
      {degradation.length > 0 && tab === 'body' && (
        <div className="tex-degradation-notice" role="status">
          {degradation.map((msg) => <span key={msg}>{msg}</span>)}
        </div>
      )}
    </section>
  );
}
