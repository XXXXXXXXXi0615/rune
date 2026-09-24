import { useEffect } from 'react';
import { useMusicEffectsStore, MUSIC_EFFECT_PRESETS, type MusicEffectPreset, type MusicEffectScope } from '@/store/useMusicEffectsStore';
import { MetalKnob, VerticalEqFader } from './ConsoleControls';

const presets: [Exclude<MusicEffectPreset, 'custom'>, string][] = [['flat','原声'],['deep-sea','深海'],['night','夜间'],['warm','温暖'],['vocal','人声']];

export function TideEqConsolePane({ trackId, playlistId }: { trackId: string; playlistId?: string }) {
  const effects = useMusicEffectsStore();
  useEffect(() => { effects.syncGraph(); }, []);
  return <div className="tide-eq-pane" data-testid="tide-eq-pane">
    {!effects.supported && <div className="hifi-fallback">当前环境不支持 Web Audio，已安全回退原声。</div>}
    <div className="eq-presets" aria-label="音效预设">{presets.map(([id,label]) => <button key={id} aria-pressed={effects.preset === id} onClick={() => effects.applyPreset(id)}>{label}</button>)}<button aria-pressed={effects.preset === 'custom'} disabled={!effects.customPreset} onClick={effects.applyCustomPreset}>自定义</button></div>
    <div className="eq-primary-controls">
      <MetalKnob label="低频" value={effects.low} min={-12} max={12} step={0.5} unit="dB" onChange={(value) => effects.setParameter('low', value)} />
      <MetalKnob label="温暖度" value={effects.warmth} min={0} max={100} step={1} unit="%" onChange={(value) => effects.setParameter('warmth', value)} />
      <MetalKnob label="空间感" value={effects.spatial} min={0} max={100} step={1} unit="%" onChange={(value) => effects.setParameter('spatial', value)} />
    </div>
    <div className="eq-faders">
      <VerticalEqFader label="Low" value={effects.low} onChange={(value) => effects.setParameter('low', value)} />
      <VerticalEqFader label="Low Mid" value={effects.lowMid} onChange={(value) => effects.setParameter('lowMid', value)} />
      <VerticalEqFader label="Mid" value={effects.mid} onChange={(value) => effects.setParameter('mid', value)} />
      <VerticalEqFader label="High Mid" value={effects.highMid} onChange={(value) => effects.setParameter('highMid', value)} />
      <VerticalEqFader label="High" value={effects.high} onChange={(value) => effects.setParameter('high', value)} />
    </div>
    <div className="eq-secondary">
      <label><span>Preamp</span><input type="range" min="-12" max="12" step="0.5" value={effects.preamp} onChange={(event) => effects.setParameter('preamp', Number(event.target.value))}/><b>{effects.preamp.toFixed(1)} dB</b></label>
      <button className={effects.loudness ? 'is-active' : ''} onClick={() => effects.setParameter('loudness', !effects.loudness)} aria-pressed={effects.loudness}>响度平衡</button>
      <button onClick={() => effects.applyPreset('flat')}>恢复原声</button>
      <button onClick={() => effects.saveCurrent(trackId, playlistId)}>保存自定义预设</button>
      <label className="eq-scope"><span>应用到</span><select value={effects.scope} onChange={(event) => effects.setScope(event.target.value as MusicEffectScope)}><option value="session">本次播放</option><option value="track">当前歌曲</option><option value="playlist" disabled={!playlistId}>当前歌单</option><option value="global">全部音乐</option></select></label>
    </div>
    <span className="sr-only">预设参数 {JSON.stringify(MUSIC_EFFECT_PRESETS[effects.preset === 'custom' ? 'flat' : effects.preset])}</span>
  </div>;
}
