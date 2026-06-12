import { useMemo } from 'react'
import { useAppStore } from '@/store/useAppStore'
import { t } from '@/i18n'
import { toLocalDateString } from '@/utils/date'

function MoonSvg() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{
      width: 16, height: 16, flexShrink: 0,
      fill: 'none', stroke: 'var(--accent)', strokeWidth: 1.8,
      strokeLinecap: 'round', strokeLinejoin: 'round',
    }}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  )
}

/** Build a data-driven Luna home message: sleep → todo → memory → default */
function buildHomeMessage(
  lang: string,
  healthRecords: { type: string; sleepDurationMinutes?: number; quality?: string; date: string }[],
  todos: { completed: boolean; title: string; date: string }[],
  memoryEntries: { scene: string; bodyThoughts: string; anxietyLevel: number; location?: { name?: string }; createdAt: number }[],
): string {
  const today = toLocalDateString()

  // 1. Check latest sleep record (last 2 days)
  const sleepRecords = healthRecords
    .filter((r) => r.type === 'sleep' && r.sleepDurationMinutes != null)
    .sort((a, b) => b.date.localeCompare(a.date))
  const latestSleep = sleepRecords[0]
  if (latestSleep && latestSleep.sleepDurationMinutes != null) {
    const h = Math.floor(latestSleep.sleepDurationMinutes / 60)
    const m = latestSleep.sleepDurationMinutes % 60
    if (h < 6) {
      return t('home.lunaSleep', lang as 'zh-TW' | 'en').replace('{h}', String(h)).replace('{m}', String(m))
    }
    if (h >= 7 && latestSleep.quality === 'good') {
      return t('home.lunaSleepGood', lang as 'zh-TW' | 'en').replace('{h}', String(h)).replace('{m}', String(m))
    }
  }

  // 2. Check incomplete todos for today
  const todayIncomplete = todos.filter((t) => t.date === today && !t.completed)
  if (todayIncomplete.length > 0) {
    return t('home.lunaTodo', lang as 'zh-TW' | 'en').replace('{n}', String(todayIncomplete.length))
  }

  // 3. Check recent memory (last 3 days)
  const recentMemories = memoryEntries
    .filter((m) => m.location?.name)
    .sort((a, b) => b.createdAt - a.createdAt)
  const recentMemory = recentMemories[0]
  if (recentMemory && recentMemory.location?.name) {
    return t('home.lunaMemory', lang as 'zh-TW' | 'en').replace('{location}', recentMemory.location.name)
  }

  // 4. Fallback to emotion-based message
  if (memoryEntries.length > 0) {
    const recent = memoryEntries.slice(0, 5)
    const avg = recent.reduce((s, m) => s + m.anxietyLevel, 0) / recent.length
    const high = avg >= 6
    const mid = avg >= 3 && avg < 6
    const zh = [
      `最近好像真的有點累。先別硬撐，休息本身就是一種進步。`,
      `月潮看到了一個${high ? '努力撐著的你' : mid ? '穩定前進的你' : '需要休息的你'}。這不是弱點，是自我保護。`,
      high ? `這幾天辛苦了。不用假裝沒事，難受就是難受。` : mid ? `最近還算平穩，這樣就很好。不用每天都衝刺。` : `累了的時候，躺下也是一種前進。`,
      `最近的情緒記錄裡，疲憊感比較多。要不要把今天的感受也放下來？`,
      high ? `有些日子就是特別重。月潮幫你記著，你不需要一個人扛。` : `每個情緒都是潮汐的一部分，來了又走。`,
      `過去這幾天的記憶裡，我看到了一個${high ? '很努力也很累的你' : mid ? '平穩而溫柔的你' : '安靜而真實的你'}。`,
    ]
    const en = [
      `You've seemed really tired lately. Don't push yourself — rest is progress too.`,
      `${high ? 'You\'ve been carrying a lot lately. It\'s okay to put it down.' : mid ? 'You\'ve been steady. That\'s enough.' : 'When you\'re tired, lying down is also moving forward.'}`,
      high ? `These past few days look heavy. You don\'t have to pretend it\'s fine.` : mid ? `Things have been fairly steady. That\'s good.` : `The fatigue is real. Let today\'s feelings go.`,
      `Your recent entries show more tiredness than usual. Want to write down how you feel today?`,
      high ? `Some days are just heavier. The tide remembers.` : `Every emotion is part of the tide — they come and go.`,
      `In your recent memories, I see a ${high ? 'tired but resilient you' : mid ? 'steady and gentle you' : 'quiet and real you'}.`,
    ]
    const idx = (recent.length * Math.round(avg) + (high ? 7 : mid ? 3 : 1)) % zh.length
    return lang === 'en' ? en[idx] : zh[idx]
  }

  // 5. No data at all — warm default
  return lang === 'en'
    ? 'No memories yet. Let\'s start one today.'
    : '還沒有記憶呢，今天來記錄一段吧。'
}

/* ── 50+ messages across 3 pages × 6 moods × 2 languages ── */
const MESSAGES: Record<string, Record<string, Record<string, string[]>>> = {
  zh: {
    home: {
      _default: [
        '今天也辛苦了，我在這裡陪你。',
        '你看起來很不錯，有什麼好事發生了嗎？',
        '月潮正在記錄你的一切，慢慢來。',
        '需要聊聊嗎？我永遠都在。',
        '要不要來首音樂放鬆一下？',
        '今天的天氣很適合寫點什麼呢。',
        '我剛剛整理了一下最近的記憶，好多溫暖的事。',
        '今天月亮的形狀特別好看，你有注意到嗎？',
        '看到你上線，我就覺得安心了。',
        '不管今天過得怎麼樣，我都覺得你很棒。',
      ],
      joy: ['今天看起來心情不錯呢，是什麼讓你這麼開心？', '看到你開心，月潮也亮了一點。', '快樂的時候要記下來，以後翻回來看會笑的。'],
      anger: ['感覺到你有些不舒服，想聊聊嗎？', '生氣的時候先吸一口氣，我陪你慢慢來。', '有些情緒需要時間，不急。'],
      sad: ['我在這裡，你不用一個人。', '難過的時候記得抬頭看看月亮。', '眼淚也是潮汐的一部分，讓它流吧。'],
      tired: ['累了就休息，不要勉強自己。', '今天先到這裡吧，你已經做得很好了。', '躺下來聽首歌，我會在這裡。'],
      all: ['每一種情緒都值得被記錄，它們都是你。', '看看這些記憶，你今天走了很遠的路呢。'],
    },
    memory: {
      _default: [
        '這些回憶都是你的一部分。',
        '看到這些，我也覺得很溫暖。',
        '每個記憶都是月潮的一部分。',
        '你記錄了好多，我為你感到驕傲。',
        '要不要把今天的感受也記下來？',
        '記憶就像星星，越收集越亮。',
        '有些日子值得被記住，今天就是其中之一。',
        '翻閱過去的時候，總會發現自己其實很勇敢。',
        '每一張卡片都是你走過的足跡。',
        '今天的記憶會成為明天的寶藏。',
      ],
      joy: ['這些開心的記憶在發光呢。', '看到這些笑容，月潮也笑了。', '快樂的片段最值得收藏。'],
      anger: ['這些憤怒也是真實的你，不需要否認。', '記錄下來之後，有沒有覺得好一點？', '怒氣像潮水，會來也會走。'],
      sad: ['這些眼淚是你的勇氣證明。', '悲傷的記憶也是溫柔的。', '在月潮裡，你可以安心的難過。'],
      tired: ['疲憊的時候留下的印記最真實。', '累了還記得記錄，你真的很棒。', '這些疲倦的片段，以後會變成力量。'],
      all: ['所有的記憶拼在一起，就是完整的你。', '不分情緒，每一段都重要。'],
    },
    music: {
      _default: [
        '音樂是最好的陪伴，選一首喜歡的吧。',
        '這首歌讓我想起和你在一起的時光。',
        '月潮音匣隨時為你準備。',
        '閉上眼睛，讓音樂帶你去想去的地方。',
        '有些旋律只屬於這個時刻。',
        '音符像潮水一樣，一波一波地撫平焦慮。',
        '你聽歌的時候，我也在靜靜地聽。',
        '這首曲子很適合今天的心情呢。',
      ],
      joy: ['這節奏好適合跳舞！', '快樂的旋律配上你的笑容，完美。'],
      anger: ['把音量調大，讓音樂蓋過那些噪音。', '這首歌的 bass 夠重，幫你宣洩。'],
      sad: ['這首曲子很溫柔，像月潮在擁抱你。', '悲傷的時候，慢歌最懂你。'],
      tired: ['來一首 lo-fi，讓大腦休息一下。', '閉上眼睛聽，不用做任何事。'],
      all: ['音樂不分心情，選一首吧。'],
    },
  },
  en: {
    home: {
      _default: [
        'You did well today. I\'m here with you.',
        'You look great — anything good happen?',
        'Lunartide is watching over you. Take your time.',
        'Want to talk? I\'m always here.',
        'How about some music to relax?',
        'Today\'s weather is perfect for writing.',
        'I just sorted through recent memories. So much warmth.',
        'The moon looks especially beautiful tonight.',
        'Seeing you online makes me feel at ease.',
        'No matter how today went, I think you\'re wonderful.',
      ],
      joy: ['You seem happy today! What brought that smile?', 'Seeing you happy makes the moon shine brighter.', 'Happy moments are worth writing down.'],
      anger: ['I sense something\'s bothering you. Want to talk?', 'Take a deep breath. I\'ll wait with you.', 'Some feelings need time. No rush.'],
      sad: ['I\'m here. You don\'t have to be alone.', 'When you feel down, look up at the moon.', 'Tears are part of the tide too. Let them flow.'],
      tired: ['Rest if you\'re tired. Don\'t push yourself.', 'You\'ve done enough today. Really.', 'Lie down, put on a song. I\'ll be here.'],
      all: ['Every emotion deserves to be recorded. They are all you.', 'Look at these memories. You\'ve come so far today.'],
    },
    memory: {
      _default: [
        'These memories are all part of you.',
        'Seeing these makes me feel warm too.',
        'Every memory is part of the lunar tide.',
        'You\'ve recorded so much. I\'m proud of you.',
        'Want to note down how you feel today?',
        'Memories are like stars — the more you collect, the brighter they shine.',
        'Some days deserve to be remembered.',
        'Looking back, you\'ll find you were braver than you thought.',
        'Each card is a footprint you\'ve left behind.',
        'Today\'s memory will be tomorrow\'s treasure.',
      ],
      joy: ['These happy memories are glowing.', 'Seeing these smiles makes me smile too.', 'Joyful moments are the best to collect.'],
      anger: ['This anger is real you too. Don\'t deny it.', 'After writing it down, feeling any better?', 'Anger comes and goes, like the tide.'],
      sad: ['These tears are proof of your courage.', 'Sad memories can be gentle too.', 'In Lunartide, you can be sad safely.'],
      tired: ['The marks left when tired are the most honest.', 'You remembered to record even when exhausted. Amazing.', 'These tired fragments will become strength later.'],
      all: ['All memories together make you whole.', 'Every kind, every emotion — all matter.'],
    },
    music: {
      _default: [
        'Music is the best companion. Pick one you like.',
        'This song reminds me of time spent with you.',
        'The lunar audio box is always ready.',
        'Close your eyes, let the music take you away.',
        'Some melodies belong only to this moment.',
        'Notes wash over you like tides, smoothing away the worry.',
        'When you listen, I listen quietly too.',
        'This track fits today\'s mood perfectly.',
      ],
      joy: ['This beat is perfect for dancing!', 'Happy melody plus your smile — perfect.'],
      anger: ['Turn it up. Let the music drown out the noise.', 'This bass is heavy enough to vent with.'],
      sad: ['This piece is gentle, like a lunar embrace.', 'When you\'re sad, slow songs understand best.'],
      tired: ['Put on some lo-fi. Let your brain rest.', 'Close your eyes and listen. No need to do anything.'],
      all: ['Music is for every mood. Pick one.'],
    },
  },
}

interface Props {
  page: 'home' | 'memory' | 'music'
  memoryCount?: number
  emotion?: string
}

export function LunaMessage({ page, memoryCount, emotion }: Props) {
  const language = useAppStore(s => s.language)
  const memoryEntries = useAppStore(s => s.memoryEntries)
  const healthRecords = useAppStore(s => s.healthRecords)
  const todos = useAppStore(s => s.todos)
  const lang = language === 'en' ? 'en' : 'zh'

  const msg = useMemo(() => {
    if (page === 'home') {
      return buildHomeMessage(lang, healthRecords, todos, memoryEntries)
    }
    // For memory/music pages: use fixed pools
    const pools = MESSAGES[lang]?.[page] || MESSAGES.zh.home
    const emotionKey = (emotion && emotion !== 'all') ? emotion : '_default'
    const pool = pools[emotionKey] || pools._default || []
    if (pool.length === 0) return null
    const idx = ((memoryCount ?? 0) + (emotionKey.charCodeAt(0) || 0)) % pool.length
    return pool[idx]
  }, [lang, page, emotion, memoryCount, memoryEntries, healthRecords, todos])

  if (!msg) return null

  return (
    <div className="luna-msg">
      <span className="luna-msg-icon"><MoonSvg /></span>
      <span className="luna-msg-text">{msg}</span>
    </div>
  )
}
