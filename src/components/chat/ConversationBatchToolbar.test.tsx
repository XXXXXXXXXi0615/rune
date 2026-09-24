import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConversationBatchToolbar } from '@/components/chat/ConversationList';
import { PET_SAFE_ZONE_SELECTOR } from '@/utils/petSafeZones';

const noop = () => undefined;

describe('ConversationBatchToolbar', () => {
  it('renders two three-item rows and disables mutations at zero selection', () => {
    const html = renderToStaticMarkup(<ConversationBatchToolbar selectedCount={0} allSelected={false} hasVisible onSelectAll={noop} onPin={noop} onArchive={noop} onDelete={noop} onCancel={noop} />);
    expect(html.match(/conv-selection-row/g)).toHaveLength(4);
    expect(html).toContain('已選 0 個');
    expect(html).toContain('刪除 0 個');
    expect(html.match(/disabled=""/g)).toHaveLength(3);
    expect(html).toContain('data-pet-safe-zone');
  });

  it('uses the shared pet safe-zone selector', () => {
    expect(PET_SAFE_ZONE_SELECTOR).toContain('[data-pet-safe-zone]');
    expect(PET_SAFE_ZONE_SELECTOR).toContain('[role="dialog"]');
  });
});
