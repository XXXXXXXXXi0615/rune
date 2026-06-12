import type { MemoryLocationPlace } from '@/types';

export const LOCATION_ALIASES: Record<string, string> = {
  床上: '失眠街',
  咖啡店: '雨夜咖啡館',
  車站: '緩衝站',
  夢裡: '月潮外海',
};

export const DEFAULT_MEMORY_LOCATIONS: MemoryLocationPlace[] = [
  {
    id: 'location-insomnia-street',
    name: '失眠街',
    icon: 'insomniaStreet',
    color: '#8E7CC3',
    description: '夜深後仍亮著微光的街道。',
    x: 18,
    y: 25,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'location-rain-cafe',
    name: '雨夜咖啡館',
    icon: 'rainyCafe',
    color: '#B8865E',
    description: '雨聲與杯緣相遇的安靜角落。',
    x: 55,
    y: 35,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'location-buffer-station',
    name: '緩衝站',
    icon: 'bufferStation',
    color: '#6B8E8E',
    description: '在抵達下一站前，先讓呼吸慢下來。',
    x: 80,
    y: 55,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'location-moon-tear-lake',
    name: '月淚湖',
    icon: 'moonTearLake',
    color: '#6BA3A3',
    description: '情緒落進湖面後，會變成柔和的波紋。',
    x: 35,
    y: 70,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'location-lunar-sea',
    name: '月潮外海',
    icon: 'tidalSea',
    color: '#C9879F',
    description: '適合收納夢境、遠方與尚未說完的話。',
    x: 65,
    y: 78,
    createdAt: 0,
    updatedAt: 0,
  },
];

export function canonicalLocationName(name: string): string {
  const trimmed = name.trim();
  return LOCATION_ALIASES[trimmed] || trimmed;
}

export function hashLocationName(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = ((hash << 5) - hash + name.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

export function createLocationPosition(name: string, offset = 0): { x: number; y: number } {
  const hash = hashLocationName(`${name}-${offset}`);
  return {
    x: 12 + (hash % 76),
    y: 14 + ((hash * 7) % 70),
  };
}
