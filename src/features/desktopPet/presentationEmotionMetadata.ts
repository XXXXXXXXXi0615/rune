import type { CompanionEmotion } from './emotionDomain';
import type { PetPresentationCategory, PetPresentationDefinition } from './types';

const CATEGORY_EMOTION: Record<PetPresentationCategory, CompanionEmotion> = {
  daily: 'neutral',
  work: 'focused',
  emotion: 'joy',
  movement: 'playful',
  special: 'surprised',
  status: 'neutral',
  http: 'concerned',
  uncategorized: 'neutral',
};

export interface EmotionMetadataInput {
  id: string;
  label: string;
  category?: PetPresentationCategory | string;
  loop?: boolean;
}

export function emotionMetadataFor(input: EmotionMetadataInput): Pick<PetPresentationDefinition, 'emotionTags' | 'interactionTags' | 'loopPolicy'> {
  const category = (Object.keys(CATEGORY_EMOTION) as PetPresentationCategory[]).includes(input.category as PetPresentationCategory)
    ? input.category as PetPresentationCategory
    : 'uncategorized';
  const emotion = CATEGORY_EMOTION[category];
  const interactionTags = category === 'emotion' ? (['tap', 'double-tap'] as const satisfies PetPresentationDefinition['interactionTags']) : undefined;
  return {
    emotionTags: [emotion],
    ...(interactionTags ? { interactionTags } : {}),
    loopPolicy: input.loop ? 'loop' : 'once',
  };
}
