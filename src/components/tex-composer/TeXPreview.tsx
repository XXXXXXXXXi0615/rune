import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const KATEX_UNSUPPORTED_CMDS = ['\\scalebox', '\\rotatebox', '\\raisebox'];

class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.warn('[TeXPreview]', error.message, info.componentStack); }
  render() {
    return this.state.failed
      ? <div className="tex-preview-error"><strong>预览暂时无法显示</strong><span>内容仍保留，请返回编辑后再试。</span></div>
      : this.props.children;
  }
}

function detectDegradation(source: string): boolean {
  return KATEX_UNSUPPORTED_CMDS.some((cmd) => source.includes(cmd));
}

function PreviewContent({ source, onReturn }: { source: string; onReturn?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'empty' | 'rendering' | 'ready' | 'error'>('empty');
  const [error, setError] = useState('');
  const renderSource = useMemo(() => source.trim().replace(/^\\\[/, '').replace(/\\\]$/, '').replace(/\\\]\s*\\\[/g, String.raw`\\[0.8em]`), [source]);
  const isDegraded = useMemo(() => detectDegradation(source), [source]);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.replaceChildren();
    if (!renderSource) { setStatus('empty'); setError(''); return; }
    setStatus('rendering');
    try {
      katex.render(renderSource, ref.current, {
        displayMode: true,
        throwOnError: true,
        strict: 'warn',
        trust: false,
        macros: { '\\scalebox': '#2', '\\rotatebox': '#2', '\\raisebox': '#2' },
      });
      setStatus('ready');
      setError('');
    } catch (reason) {
      setStatus('error');
      setError(reason instanceof Error ? reason.message : '无法解析这段 LaTeX。');
    }
  }, [renderSource]);

  return (
    <section className="tex-panel tex-preview-panel" aria-label="实时预览">
      <div className="tex-panel-head"><div><span>实时预览</span><small>{status === 'ready' ? '已更新' : status === 'rendering' ? '正在渲染' : status === 'error' ? '语法错误' : '内容为空'}</small></div></div>
      <div className="tex-preview-paper">
        <div ref={ref} className="tex-preview-render" />
        {status === 'empty' && <div className="tex-preview-empty">加入文字或区块后，预览会出现在这里。</div>}
        {status === 'error' && <div className="tex-preview-error"><strong>LaTeX 无法渲染</strong><span>{error}</span>{onReturn && <button type="button" onClick={onReturn}>返回编辑</button>}</div>}
        {isDegraded && status === 'ready' && (
          <div className="tex-degradation-inline" role="status">网页预览已简化；完整导出保留原命令。</div>
        )}
      </div>
    </section>
  );
}

export function TeXPreview(props: { source: string; onReturn?: () => void }) {
  return <PreviewBoundary><PreviewContent {...props} /></PreviewBoundary>;
}
