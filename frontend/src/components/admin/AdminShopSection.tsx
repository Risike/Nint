import React, { useEffect, useState } from 'react';
import { CheckCircle2, Edit, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { ApiClient } from '../../services/api';
import { useI18n } from '../../i18n/useI18n';
import { getShopTitleLabel } from '../../i18n/titles';
import { getShopItemLabel, getPieceSkinLabel, getNameDecorationLabel } from '../../i18n/shopItems';

type ShopKind = 'piece_skin' | 'name_color' | 'name_decoration' | 'title';

interface AdminShopItem {
  id: string;
  kind: ShopKind;
  name: string;
  value: string;
  price: number;
  is_default: number;
  active: number;
  sort_order: number;
}

interface ShopForm {
  kind: ShopKind;
  name: string;
  value: string;
  price: number;
  sort_order: number;
  active: boolean;
}

const EMPTY_FORM: ShopForm = {
  kind: 'piece_skin',
  name: '',
  value: 'classic',
  price: 0,
  sort_order: 0,
  active: true
};

const KIND_LABELS: Record<ShopKind, string> = {
  piece_skin: 'Piece skin',
  name_color: 'Name color',
  name_decoration: 'Name decoration',
  title: 'Title'
};

const PIECE_SKIN_OPTIONS = [
  'classic', 'neon', 'glass', 'pixel', 'candy',
  'retro', 'metallic', 'holographic', 'mosaic', 'circuit',
  'gradient', 'checker', 'striped', 'glossy', 'matte',
  'gem', 'wood', 'marble', 'carbon', 'ice'
];
const DECORATION_OPTIONS = [
  'none', 'glow', 'underline', 'brackets', 'sparkle',
  'double_underline', 'overline', 'shadow', 'outline', 'pill', 'box',
  'dots', 'wave', 'angles', 'stars', 'diamonds', 'arrows',
  'brackets_square', 'parentheses', 'highlight'
];

const defaultValueFor = (kind: ShopKind): string => {
  if (kind === 'piece_skin') return 'classic';
  if (kind === 'name_color') return '#22d3ee';
  if (kind === 'name_decoration') return 'none';
  return '';
};

export const AdminShopSection: React.FC = () => {
  const { t, language } = useI18n();
  const [items, setItems] = useState<AdminShopItem[]>([]);
  const [form, setForm] = useState<ShopForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ApiClient.adminGetShopItems();
      setItems(result || []);
    } catch (e: any) {
      setError(e?.message || t('Failed to load shop'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadItems();
  }, []);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const updateKind = (kind: ShopKind) => {
    setForm((previous) => ({
      ...previous,
      kind,
      value: defaultValueFor(kind)
    }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    const payload = {
      kind: form.kind,
      name: form.name,
      value: form.value,
      price: Number(form.price),
      sort_order: Number(form.sort_order),
      active: form.active
    };
    try {
      if (editingId) {
        await ApiClient.adminUpdateShopItem(editingId, payload);
      } else {
        await ApiClient.adminCreateShopItem(payload);
      }
      setMessage(t('Shop item saved successfully.'));
      resetForm();
      await loadItems();
    } catch (e: any) {
      setError(e?.message || t('Failed to save shop item.'));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: AdminShopItem) => {
    setEditingId(item.id);
    setForm({
      kind: item.kind,
      name: item.name,
      value: item.value,
      price: item.price,
      sort_order: item.sort_order,
      active: Boolean(item.active)
    });
    setMessage(null);
    setError(null);
  };

  const remove = async (item: AdminShopItem) => {
    if (item.is_default) {
      setError(t('Default shop items cannot be edited or deleted.'));
      return;
    }
    if (!window.confirm(t('Delete this shop item?'))) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      await ApiClient.adminDeleteShopItem(item.id);
      if (editingId === item.id) {
        resetForm();
      }
      setMessage(t('Shop item deleted successfully.'));
      await loadItems();
    } catch (e: any) {
      setError(e?.message || t('Failed to delete shop item.'));
    }
  };

  return (
    <div className="panel-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
        <ShoppingBag size={20} style={{ color: 'var(--accent-cyan)' }} />
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {t('Shop management')}
        </h2>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        {t('Create and manage the items available in the shop.')}
      </p>

      {message && (
        <div style={{ color: 'var(--accent-green)', fontSize: '0.85rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <CheckCircle2 size={14} /> {message}
        </div>
      )}
      {error && <p style={{ color: 'var(--accent-red)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>{error}</p>}

      <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem', padding: '1rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          {t('Item type')}
          <select value={form.kind} onChange={(e) => updateKind(e.target.value as ShopKind)} style={{ padding: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}>
            {Object.entries(KIND_LABELS).map(([kind, label]) => <option key={kind} value={kind}>{t(label)}</option>)}
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          {t('Item name')}
          <input required minLength={2} maxLength={48} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ padding: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }} />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          {t('Item value')}
          {form.kind === 'piece_skin' ? (
            <select value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} style={{ padding: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}>
              {PIECE_SKIN_OPTIONS.map((option) => <option key={option} value={option}>{getPieceSkinLabel(option, language)}</option>)}
            </select>
          ) : form.kind === 'name_decoration' ? (
            <select value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} style={{ padding: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}>
              {DECORATION_OPTIONS.map((option) => <option key={option} value={option}>{getNameDecorationLabel(option, language)}</option>)}
            </select>
          ) : form.kind === 'name_color' ? (
            <input type="color" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} style={{ height: '36px', padding: '0.2rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }} />
          ) : (
            <input required maxLength={40} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} style={{ padding: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }} />
          )}
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          {t('Price')}
          <input type="number" min={0} max={1000000} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} style={{ padding: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }} />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          {t('Sort order')}
          <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} style={{ padding: '0.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }} />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', color: 'var(--text-secondary)', alignSelf: 'end', paddingBottom: '0.5rem' }}>
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          {t('Active')}
        </label>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'end', paddingBottom: '0.05rem' }}>
          <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '0.5rem 0.9rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Plus size={14} /> {saving ? t('Saving...') : editingId ? t('Save item') : t('Add item')}
          </button>
          {editingId && (
            <button type="button" className="btn-secondary" onClick={resetForm} style={{ padding: '0.5rem 0.9rem', fontSize: '0.82rem' }}>
              {t('Cancel')}
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('Loading...')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {items.map((item) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '0.7rem 0.8rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <strong style={{ fontSize: '0.88rem' }}>
                    {item.kind === 'title' ? getShopTitleLabel(item.id, item.value, language) : getShopItemLabel(item.id, item.name, language)}
                  </strong>
                  {item.is_default === 1 && <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '999px', padding: '0.1rem 0.4rem' }}>{t('Default item')}</span>}
                  <span style={{ fontSize: '0.66rem', color: item.active ? 'var(--accent-green)' : 'var(--text-muted)' }}>{item.active ? t('Active') : t('Inactive')}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  {t(KIND_LABELS[item.kind])} · {item.value || '—'} · {item.price} {t('Credits')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => startEdit(item)}
                  disabled={Boolean(item.is_default)}
                  title={item.is_default ? t('Default shop items cannot be edited or deleted.') : t('Edit')}
                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', cursor: item.is_default ? 'not-allowed' : 'pointer', opacity: item.is_default ? 0.45 : 1, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <Edit size={12} /> {t('Edit')}
                </button>
                <button
                  type="button"
                  onClick={() => void remove(item)}
                  disabled={Boolean(item.is_default)}
                  title={item.is_default ? t('Default shop items cannot be edited or deleted.') : t('Delete')}
                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.12)', color: 'var(--accent-red)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)', cursor: item.is_default ? 'not-allowed' : 'pointer', opacity: item.is_default ? 0.45 : 1, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <Trash2 size={12} /> {t('Delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
