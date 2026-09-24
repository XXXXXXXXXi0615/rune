import type { PetLibraryCategory, PetPresentationCategory } from '../types';

const HTTP_NAMES: Record<string, string> = {
  '200': '請求成功', '201': '已建立', '204': '沒有內容', '301': '前往別處',
  '400': '請求有誤', '401': '需要驗證', '402': '需要付款', '403': '拒絕存取',
  '404': '找不到內容', '408': '等待逾時', '410': '內容已離開', '418': '暫停沖泡',
  '429': '請稍後再試', '451': '內容受限', '500': '系統異常', '502': '連線異常',
  '503': '暫時休息', '504': '連線逾時',
};

const NAMES: Record<string, string> = {
  Angry:'生氣', Astronaut:'太空人', Autumn:'秋日', 'Battery Low':'電量不足', Birthday:'生日快樂', Bored:'無聊', Bowling:'保齡球', Camping:'露營', Celebrating:'慶祝', Charging:'充電中', Chef:'主廚', Christmas:'聖誕節', Clapping:'鼓掌', Climbing:'攀爬', Coding:'寫程式', Coffee:'喝咖啡', Confused:'困惑', Cool:'耍酷', 'Crab Walking':'螃蟹走路', Crafting:'製作中', Crying:'哭泣', Dancing:'跳舞', Detective:'偵探', Disconnected:'連線中斷', Dizzy:'頭暈', Dj:'播放音樂', Driving:'開車', Drumming:'打鼓', Eating:'吃東西', Embarrassed:'害羞', Evil:'壞心情', Facepalm:'傻眼', Fire:'著火了', Fishing:'釣魚', Flexing:'展現力量', Flying:'飛行', Gaming:'玩遊戲', Gardening:'園藝', Gift:'送禮物', 'Going Away':'準備離開', Grumpy:'不高興', Halloween:'萬聖節', Hallucinating:'看見幻象', Hopeful:'充滿期待', 'Ice Cream':'吃冰淇淋', Idea:'想到辦法', Jealous:'吃醋', King:'國王', Laughing:'大笑', Lifting:'舉重', Loading:'載入中', Love:'喜歡', Magic:'施展魔法', Mail:'送信', Meditating:'冥想', Mindblown:'大受震撼', Money:'數錢', Music:'聽音樂', 'New Year':'新年', Ninja:'忍者', Painting:'畫畫', Peeking:'偷看', Photography:'拍照', Pirate:'海盜', Podcast:'錄製節目', Praying:'祈禱', Rainbow:'彩虹', Rocket:'搭火箭', Security:'安全守護', Shipping:'寄送中', Skeptical:'半信半疑', Smile:'微笑', Snow:'雪天', Spring:'春日', Star:'看星星', 'Static Base':'安靜待機', Studying:'讀書', Summer:'夏日', Superhero:'超級英雄', Surfing:'衝浪', Surprised:'驚訝', Swimming:'游泳', Telescope:'看遠方', Thanksgiving:'感恩節', 'Time Travel':'時光旅行', Trophy:'獲得獎盃', Umbrella:'撐傘', Valentine:'情人節', Waving:'揮手', Winter:'冬日', Yawning:'打呵欠', Yoga:'做瑜伽',
  'Working Beacon':'發送訊號', 'Working Building':'建置中', 'Working Carrying':'搬運中', 'Working Conducting':'指揮中', 'Working Confused':'工作中困惑', 'Working Context Full':'工作記憶已滿', 'Working Firefighting':'緊急處理', 'Working Juggling':'多工處理', 'Working Meeting':'開會中', 'Working Merging':'合併中', 'Working Oncall':'待命中', 'Working Overheated':'工作過熱', 'Working Pairing':'協作中', 'Working Pushing':'推送中', 'Working Rubber Duck':'橡皮鴨除錯', 'Working Testing':'測試中', 'Working Wizard':'施展工作魔法',
};

const MOVEMENT_IDS = /clawd-(climbing|crab-walking|driving|flying|going-away|rocket|running|shipping|skateboard|surfing|swimming)/;

export function localizeClawdPresentation(id: string, rawLabel: string, category: PetPresentationCategory) {
  const displayName = HTTP_NAMES[rawLabel] ?? NAMES[rawLabel] ?? (/\p{Script=Han}/u.test(rawLabel) ? rawLabel : '未命名表現');
  const libraryCategory: PetLibraryCategory = category === 'work' ? 'work'
    : category === 'emotion' ? 'emotion'
      : category === 'http' ? 'http'
        : category === 'special' ? 'special'
          : category === 'movement' ? (MOVEMENT_IDS.test(id) ? 'movement' : 'activity')
            : 'daily';
  const categoryLabel = ({ daily:'日常', work:'工作', emotion:'情緒', activity:'活動', movement:'移動', http:'網路狀態', special:'特別' } as const)[libraryCategory];
  return {
    displayName,
    localizedNames: { 'zh-TW': displayName, en: rawLabel },
    categoryLabel,
    libraryCategory,
    searchKeywords: Array.from(new Set([displayName, rawLabel, categoryLabel, ...id.replace(/^clawd-/, '').split('-')].filter(Boolean))),
  };
}
