/* ═══════════════════════════════════════════════
   Theme Presets
   ═══════════════════════════════════════════════ */

export interface ThemePreset {
  id: string;
  label: string;
  /** Global CSS (zone: global) */
  global?: string;
  /** Chat UI CSS (zone: chat) */
  chat?: string;
  /** Luna bubble CSS (zone: luna) */
  luna?: string;
  /** User bubble CSS (zone: user) */
  user?: string;
}

export const PRESETS: ThemePreset[] = [
  {
    id: 'sillytavern',
    label: 'SillyTavern',
    global: `/* SillyTavern 風格 — 深色 + 溫暖暗底 */
body {
  background: #1a1a2e;
  color: #e0d7c8;
}
* {
  scrollbar-width: thin;
  scrollbar-color: #3a3a5c transparent;
}`,
    chat: `/* SillyTavern 聊天介面 */
#chat-view {
  background: #16162a;
  padding: 12px;
  border-radius: 12px;
}`,
    luna: `/* SillyTavern Luna 氣泡 */
.message-bubble {
  background: #2a2a4a;
  border: 1px solid #3d3d6b;
  border-radius: 12px 12px 12px 4px;
  color: #d4cfc0;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}`,
    user: `/* SillyTavern 我的氣泡 */
.message-bubble {
  background: #4a4a8a;
  border: 1px solid #5c5caa;
  border-radius: 12px 12px 4px 12px;
  color: #ffffff;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}`,
  },
  {
    id: 'ios-glass',
    label: 'iOS Glass',
    global: `/* iOS Glass 風格 */
body {
  background: linear-gradient(135deg, #e8e4f0, #dce8f4, #e8f0e4);
}`,
    chat: `/* iOS 聊天介面 */
#chat-view {
  background: transparent;
}`,
    luna: `/* iOS 毛玻璃 Luna 氣泡 */
.message-bubble {
  background: rgba(255,255,255,0.55);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  border: 1px solid rgba(255,255,255,0.6);
  border-radius: 18px 18px 18px 6px;
  color: #1c1c1e;
  font-size: 15px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.04);
}`,
    user: `/* iOS 藍色毛玻璃氣泡 */
.message-bubble {
  background: rgba(0,122,255,0.85);
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
  border: 1px solid rgba(0,122,255,0.3);
  border-radius: 18px 18px 6px 18px;
  color: #ffffff;
  font-size: 15px;
  box-shadow: 0 4px 16px rgba(0,122,255,0.15);
}`,
  },
  {
    id: 'discord',
    label: 'Discord',
    global: `/* Discord 風格 */
body {
  background: #313338;
  color: #dbdee1;
}`,
    chat: `/* Discord 聊天介面 */
#chat-view {
  background: #2b2d31;
  padding: 8px 12px;
}`,
    luna: `/* Discord 風格 Luna 氣泡 */
.message-bubble {
  background: transparent;
  color: #dbdee1;
  font-size: 15px;
  border-radius: 4px;
}
.message-bubble:hover {
  background: #2e3035;
}`,
    user: `/* Discord 風格我的氣泡 */
.message-bubble {
  background: transparent;
  color: #dbdee1;
  font-size: 15px;
  border-radius: 4px;
}
.message-bubble:hover {
  background: #2e3035;
}`,
  },
  {
    id: 'glassmorphism',
    label: 'Glassmorphism',
    global: `/* Glassmorphism 全域 */
body {
  background: linear-gradient(135deg, #4158d0 0%, #c850c0 46%, #ffcc70 100%);
  background-attachment: fixed;
  color: #fff;
}`,
    chat: `/* Glassmorphism 聊天 */
#chat-view {
  background: rgba(255,255,255,0.08);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 20px;
}`,
    luna: `/* Glassmorphism Luna 氣泡 */
.message-bubble {
  background: rgba(255,255,255,0.12);
  backdrop-filter: blur(16px) saturate(160%);
  -webkit-backdrop-filter: blur(16px) saturate(160%);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 16px 16px 16px 4px;
  color: #fff;
  font-size: 14px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.1);
}`,
    user: `/* Glassmorphism 我的氣泡 */
.message-bubble {
  background: rgba(255,255,255,0.25);
  backdrop-filter: blur(16px) saturate(160%);
  -webkit-backdrop-filter: blur(16px) saturate(160%);
  border: 1px solid rgba(255,255,255,0.32);
  border-radius: 16px 16px 4px 16px;
  color: #fff;
  font-size: 14px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.12);
}`,
  },
];

export function getPreset(id: string): ThemePreset | undefined {
  return PRESETS.find(p => p.id === id);
}
