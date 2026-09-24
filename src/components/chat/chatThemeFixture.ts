import type { TextMessage } from '@/types';

/**
 * Rune Chat Theme Phase 1.1 — production conversation fixture.
 *
 * Canonical fixture for long-conversation visual acceptance. Rendered with
 * the real `MessageBubble` (no fake bubble renderer). Covers the Phase 1.1
 * coverage matrix: short/multiline user, short/long agent, consecutive
 * same-speaker runs, link, inline code, code block, quote, emoji, English,
 * Chinese, timestamps.
 */

const base = Date.parse('2026-09-01T20:00:00+08:00');
const at = (minutes: number) => new Date(base + minutes * 60_000).toISOString();

export const CHAT_THEME_FIXTURE_MESSAGES: TextMessage[] = [
  { id: 'fx-01-agent-short', type: 'text', sender: 'assistant', content: '晚安。今天的潮位記錄我看過了。', time: at(0), status: 'read' },
  { id: 'fx-02-me-short', type: 'text', sender: 'me', content: '嗯，今天喝了 1500ml 的水。', time: at(1), status: 'read' },
  { id: 'fx-03-me-multi', type: 'text', sender: 'me', content: '不過下午有點崩。\n會議開到三點，\n回來才想起午飯沒吃。', time: at(2), status: 'read' },
  { id: 'fx-04-agent-link', type: 'text', sender: 'assistant', content: '先休息一下。這份 [生活帳本索引](https://lunartide.local/life-ledger) 可以回看近期留下的記錄。', time: at(3), status: 'read' },
  { id: 'fx-05-agent-inline', type: 'text', sender: 'assistant', content: '如果你只想記一筆，用 `ledger note add` 就好，不用開完整表單。', time: at(4), status: 'read' },
  { id: 'fx-06-agent-code', type: 'text', sender: 'assistant', content: '批量整理的話：\n\n```\nledger export --format json\n```\n\n先匯出備份，再做後續整理。', time: at(5), status: 'read' },
  { id: 'fx-07-me-quote', type: 'text', sender: 'me', content: '> 你昨晚只睡了 4.5 小時\n我知道，但那個 demo 不做完今天站不上台。', time: at(6), status: 'read' },
  { id: 'fx-08-agent-emoji', type: 'text', sender: 'assistant', content: '上完台就立刻去睡，聽到了嗎 🌙 順手把指甲放下來，別咬了。', time: at(7), status: 'read' },
  { id: 'fx-09-agent-en', type: 'text', sender: 'assistant', content: 'One more thing: the tide chart for September is already synced, so the morning brief will include the 5:40am high tide.', time: at(8), status: 'read' },
  { id: 'fx-10-me-en-short', type: 'text', sender: 'me', content: 'Got it. Thanks.', time: at(9), status: 'read' },
  { id: 'fx-11-agent-long', type: 'text', sender: 'assistant', content: '關於明天，我把節奏排鬆了一點：早上只留了晨報與回信兩件事，下午才是深度工作時段。你昨晚的專注輪數只有兩輪，與其硬撐八輪，不如先從三輪開始，中間用十 分鐘的潮汐休息把眼睛從螢幕上拉開。如果你願意，我可以把今晚的提醒提前到十二點半，而不是凌晨兩點。', time: at(10), status: 'read' },
  { id: 'fx-12-me-consecutive-a', type: 'text', sender: 'me', content: '先別提前，今晚真的要收尾。', time: at(11), status: 'read' },
  { id: 'fx-13-me-consecutive-b', type: 'text', sender: 'me', content: '但十二點半的提醒可以留著，我試一次。', time: at(11), status: 'read' },
  { id: 'fx-14-me-consecutive-c', type: 'text', sender: 'me', content: '還有，明天的月相卡片幫我換成上弦月。', time: at(12), status: 'read' },
  { id: 'fx-15-agent-short', type: 'text', sender: 'assistant', content: '都記下了。快去忙吧。', time: at(13), status: 'read' },
  { id: 'fx-16-agent-tail', type: 'text', sender: 'assistant', content: '（潮汐觀測已同步：今日低潮 23:12，夜間風平，適合收尾。）', time: at(14), status: 'read' },
];
