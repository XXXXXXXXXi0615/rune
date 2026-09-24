export interface UpdateRelease {
  version: string;
  title: string;
  summary: string;
  items: string[];
}

export const CURRENT_RELEASE: UpdateRelease = {
  version: '2026.06.15',
  title: '月潮更新',
  summary: '訂閱追蹤、行動版更多 Drawer、AI Provider 真實資料串接。',
  items: [
    '訂閱管理系統上線（分類 / 帳單週期 / 自動續約）',
    '行動版底部導覽加入「更多」Drawer，可前往音樂、訂閱、作品庫與專注',
    'AI Provider 真實資料流串接，Luna 對話可使用實體模型',
    '設定狀態概覽改為讀取真實 Store 資料',
    '狀態概覽與角色／技能模態框的 Emoji 圖標遷移至 SVG',
    'Clawd 桌寵支援底部導航感知的右下角定位',
  ],
};

export const UPDATE_SEEN_KEY = 'lunartide_update_seen_version_v1';
