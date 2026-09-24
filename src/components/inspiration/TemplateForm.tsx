// ================================================================
// TemplateForm — structured schema-driven form
//
// Renders editable fields from a TemplateSchema.
// Serializes to content string on save (backward-compatible storage).
// ================================================================

import { useState } from 'react';
import type { TemplateSchema, TemplateField } from '@/utils/templateSchemas';
import { defaultTemplateValues, serializeTemplateFields } from '@/utils/templateSchemas';
import type { InspirationType } from '@/utils/inspirationStorage';

interface TemplateFormProps {
  schema: TemplateSchema;
  onSave: (data: { type: InspirationType; title: string; content: string; tags: string[] }) => void;
  onClose: () => void;
}

function TextListField({ field, items, onChange }: {
  field: TemplateField;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [newItem, setNewItem] = useState('');

  const add = () => {
    const v = newItem.trim();
    if (!v) return;
    onChange([...items, v]);
    setNewItem('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ flex: 1, padding: '7px 10px', borderRadius: 8, background: 'var(--surface-2)', fontSize: 13, color: 'var(--text-2)' }}>{item}</span>
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}
            style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14 }}
            aria-label={field.removeLabel || '移除'}>−</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          placeholder={field.placeholder || ''}
          style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px dashed var(--border)', background: 'var(--surface)', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit' }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button type="button" onClick={add}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--accent)', background: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent)', cursor: 'pointer', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>
          {field.addLabel || '+ 新增'}
        </button>
      </div>
    </div>
  );
}

function SchemaField({ field, value, onChange }: {
  field: TemplateField;
  value: string | string[];
  onChange: (val: string | string[]) => void;
}) {
  switch (field.type) {
    case 'text':
      return (
        <input
          type="text"
          value={String(value)}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder || ''}
          className="tmpl-field-input"
        />
      );
    case 'textarea':
      return (
        <textarea
          value={String(value)}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder || ''}
          rows={3}
          className="tmpl-field-textarea"
        />
      );
    case 'select':
      return (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {(field.options || []).map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(value === opt ? '' : opt)}
              style={{
                padding: '5px 12px', borderRadius: 999, border: `1.5px solid ${value === opt ? 'var(--accent)' : 'var(--border)'}`,
                background: value === opt ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--surface)',
                color: value === opt ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer', fontSize: 12, fontWeight: value === opt ? 600 : 400,
                fontFamily: 'inherit',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      );
    case 'textList':
      return <TextListField field={field} items={Array.isArray(value) ? value : []} onChange={onChange as (items: string[]) => void} />;
    default:
      return null;
  }
}

export function TemplateForm({ schema, onSave, onClose }: TemplateFormProps) {
  const [values, setValues] = useState<Record<string, string | string[]>>(() => defaultTemplateValues(schema));

  const handleFieldChange = (key: string, val: string | string[]) => {
    setValues(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = () => {
    const content = serializeTemplateFields(schema, values);
    onSave({ type: schema.type, title: schema.title, content, tags: [schema.type, 'template'] });
  };

  return (
    <div className="quick-sheet-overlay active" onClick={onClose}>
      <div className="quick-sheet" onClick={e => e.stopPropagation()} style={{ maxHeight: '85dvh', display: 'flex', flexDirection: 'column' }}>
        <div className="quick-sheet-handle" />
        <div className="quick-sheet-head">
          <span className="quick-sheet-title">{schema.title} · 結構化表單</span>
        </div>
        <div className="quick-sheet-body" style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 16px' }}>
          <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 16, lineHeight: 1.5 }}>
            {schema.description}
          </p>
          {schema.fields.map(field => (
            <div key={field.key} style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                {field.label}
              </label>
              <p style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 8 }}>{field.hint}</p>
              <SchemaField
                field={field}
                value={values[field.key] || ''}
                onChange={val => handleFieldChange(field.key, val)}
              />
            </div>
          ))}
        </div>
        <div className="quick-sheet-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>取消</button>
          <button type="button" className="btn-primary" onClick={handleSave}>建立</button>
        </div>
      </div>
    </div>
  );
}
