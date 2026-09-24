import type { GameCategory, GameDefinition, ReleaseChannel } from './types';

export const CATEGORY_LABELS: Record<'all' | GameCategory, string> = { all: '全部', 'story-simulation': '剧情与模拟', 'board-card': '棋盘与牌桌', 'social-deduction': '社交推理', casual: '轻量小游戏', custom: '自定义' };
export const GAME_REGISTRY: readonly GameDefinition[] = [
  { id: 'free-roleplay', title: '自由角色扮演', description: '选择世界、角色与叙事视角，共同写下会改变的故事。', category: 'story-simulation', engineType: 'structured-narrative', playerRange: { min: 1, max: 6 }, supportsOfflineBot: false, supportsModelAgent: true, supportsChatInvite: true, supportsHumanOnline: false, route: '/playroom/new/free-roleplay', coverAssetId: 'playroom-roleplay', status: 'playable', releaseChannel: 'public', scenarioVersion: 1 },
  { id: 'scenario-simulator', title: '情境模拟器', description: '为一次选择建立可反复尝试的情境。', category: 'story-simulation', engineType: 'scenario', playerRange: { min: 1, max: 4 }, supportsOfflineBot: false, supportsModelAgent: true, supportsChatInvite: true, supportsHumanOnline: false, route: '/playroom', coverAssetId: 'playroom-scenario', status: 'experimental', releaseChannel: 'experimental', scenarioVersion: 1 },
  { id: 'character-growth', title: '角色养成', description: '陪角色跨过日常与长期成长。', category: 'story-simulation', engineType: 'growth', playerRange: { min: 1, max: 3 }, supportsOfflineBot: false, supportsModelAgent: true, supportsChatInvite: true, supportsHumanOnline: false, route: '/playroom', coverAssetId: 'playroom-growth', status: 'planned', releaseChannel: 'development', scenarioVersion: 1 },
  { id: 'gomoku', title: '五子棋', description: '本地双人或与传统 Bot、聊天角色对弈。', category: 'board-card', engineType: 'deterministic-gomoku', playerRange: { min: 2, max: 2 }, supportsOfflineBot: true, supportsModelAgent: true, supportsChatInvite: true, supportsHumanOnline: false, route: '/playroom/new/gomoku', coverAssetId: 'playroom-gomoku', status: 'playable', releaseChannel: 'public', scenarioVersion: 1 },
  { id: 'dou-dizhu', title: '斗地主', description: '三人牌桌与角色互动。', category: 'board-card', engineType: 'card', playerRange: { min: 3, max: 3 }, supportsOfflineBot: true, supportsModelAgent: true, supportsChatInvite: true, supportsHumanOnline: false, route: '/playroom', coverAssetId: 'playroom-doudizhu', status: 'planned', releaseChannel: 'development', scenarioVersion: 1 },
  { id: 'mahjong', title: '麻将', description: '确定性规则驱动的四人牌桌。', category: 'board-card', engineType: 'tile', playerRange: { min: 4, max: 4 }, supportsOfflineBot: true, supportsModelAgent: true, supportsChatInvite: true, supportsHumanOnline: false, route: '/playroom', coverAssetId: 'playroom-mahjong', status: 'planned', releaseChannel: 'development', scenarioVersion: 1 },
  { id: 'werewolf-night', title: '狼人之夜', description: '身份、发言与推理都各有边界。', category: 'social-deduction', engineType: 'social-deduction', playerRange: { min: 6, max: 12 }, supportsOfflineBot: true, supportsModelAgent: true, supportsChatInvite: true, supportsHumanOnline: false, route: '/playroom', coverAssetId: 'playroom-werewolf', status: 'planned', releaseChannel: 'development', scenarioVersion: 1 },
] as const;

export function getGameDefinition(id: string): GameDefinition | undefined {
  return GAME_REGISTRY.find((game) => game.id === id);
}

export function getVisibleGames(previewGames: boolean): GameDefinition[] {
  return GAME_REGISTRY.filter((g) => {
    if (previewGames) return true;
    return g.releaseChannel === 'public';
  });
}

export function getPublicGames(): GameDefinition[] {
  return GAME_REGISTRY.filter((g) => g.releaseChannel === 'public');
}

export function getExperimentalGames(): GameDefinition[] {
  return GAME_REGISTRY.filter((g) => g.releaseChannel === 'experimental' && g.status === 'playable');
}
