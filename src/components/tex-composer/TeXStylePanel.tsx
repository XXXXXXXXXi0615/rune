import { ColorPickerField } from './ColorPickerField';
import type { TeXBlock, TeXTextStyle } from '@/features/tex-composer/types';

export function TeXStylePanel({ block, onChange }: { block?: TeXBlock; onChange: (block: TeXBlock) => void }) {
  if (!block) return <section className="tex-panel tex-style-panel"><div className="tex-panel-head"><div><span>样式</span><small>选择一个区块</small></div></div><div className="tex-style-empty">选择左侧区块后调整样式。</div></section>;
  const style = block.style;
  const updateStyle = (patch: Partial<TeXTextStyle>) => onChange({ ...block, style: { ...style, ...patch } });
  return (
    <section className="tex-panel tex-style-panel">
      <div className="tex-panel-head"><div><span>样式</span><small>{block.type}</small></div></div>
      <div className="tex-style-fields">
        <label><span>字号</span><select value={style.fontSize} onChange={(event) => updateStyle({ fontSize: event.target.value as TeXTextStyle['fontSize'] })}><option value="tiny">tiny</option><option value="scriptsize">scriptsize</option><option value="small">small</option><option value="normalsize">normalsize</option><option value="large">large</option></select></label>
        <label><span>字体</span><select value={style.fontFamily} onChange={(event) => updateStyle({ fontFamily: event.target.value as TeXTextStyle['fontFamily'] })}><option value="default">默认</option><option value="sans">Sans Serif</option><option value="roman">Roman</option><option value="mono">Monospace</option></select></label>
        <label className="tex-switch"><span>粗体</span><input type="checkbox" checked={style.bold} onChange={(event) => updateStyle({ bold: event.target.checked })} /></label>
        <ColorPickerField label="文字颜色" value={style.textColor} onChange={(textColor) => updateStyle({ textColor })} />
        <ColorPickerField label="背景颜色" value={style.backgroundColor} onChange={(backgroundColor) => updateStyle({ backgroundColor })} />
        <ColorPickerField label="边框颜色" value={style.borderColor} onChange={(borderColor) => updateStyle({ borderColor })} />
        <label><span>缩放</span><input type="number" min="0.1" max="20" step="0.1" value={style.scale} onChange={(event) => updateStyle({ scale: Number(event.target.value) })} /></label>
        <label><span>旋转角度</span><input type="number" min="-360" max="360" value={style.rotation} onChange={(event) => updateStyle({ rotation: Number(event.target.value) })} /></label>
        <label><span>垂直偏移</span><input value={style.raise} onChange={(event) => updateStyle({ raise: event.target.value })} placeholder="-0.12em" /></label>
        <label><span>水平间距</span><input value={style.hspace} onChange={(event) => updateStyle({ hspace: event.target.value })} placeholder="1em" /></label>
        <label><span>对齐</span><select value={style.align} onChange={(event) => updateStyle({ align: event.target.value as TeXTextStyle['align'] })}><option value="left">左</option><option value="center">中</option><option value="right">右</option></select></label>
        {block.type === 'rule' && <><label><span>分隔线宽度</span><input value={block.ruleWidth} onChange={(event) => onChange({ ...block, ruleWidth: event.target.value })} /></label><label><span>分隔线高度</span><input value={block.ruleHeight} onChange={(event) => onChange({ ...block, ruleHeight: event.target.value })} /></label></>}
        {block.type === 'columns' && <><label><span>栏间距</span><input value={block.columnGap} onChange={(event) => onChange({ ...block, columnGap: event.target.value })} /></label><label><span>Array 对齐</span><select value={block.arrayAlign} onChange={(event) => onChange({ ...block, arrayAlign: event.target.value as 'c' | 'l' | 'r' })}><option value="c">c</option><option value="l">l</option><option value="r">r</option></select></label></>}
      </div>
    </section>
  );
}
