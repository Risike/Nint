import React, { useEffect, useState } from 'react';
import { Check, CheckCircle2, Edit, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { ApiClient } from '../../services/api';
import { useI18n } from '../../i18n/useI18n';
import { getShopItemDisplayName, getPieceSkinLabel } from '../../i18n/shopItems';
import { PIECE_SKINS } from '../../game/rendering/pieceSkins';
import { getProfileIconEmoji } from '../../i18n/profileIcons';
import { parseNameColor } from '../../utils/nameColor';
import { DEFAULT_THEME_PREVIEW, type ThemePreview } from '../../i18n/themes';
import { UserName } from '../user/UserName';
import { useNameDecorations } from '../../context/NameDecorationContext';
import { getDefaultDecorationHtml } from '../../utils/nameDecoration';

export type ShopKind = 'piece_skin' | 'name_color' | 'name_decoration' | 'profile_icon' | 'title' | 'theme';

interface AdminShopItem {
  id: string;
  kind: ShopKind;
  name: string;
  name_fr: string;
  name_de: string;
  name_es: string;
  name_it: string;
  value: string;
  mode?: 'dark' | 'light';
  palette?: ThemePreview | null;
  html?: string | null;
  price: number;
  is_default: number;
  active: number;
  sort_order: number;
}

interface ShopForm {
  name: string;
  name_fr: string;
  name_de: string;
  name_es: string;
  name_it: string;
  value: string;
  mode: 'dark' | 'light';
  palette: ThemePreview;
  html: string;
  price: number;
  sort_order: number;
  active: boolean;
}

interface AdminShopSectionProps {
  kind: ShopKind;
}

const KIND_LABELS: Record<ShopKind, string> = {
  piece_skin: 'Piece skin',
  name_color: 'Name color',
  name_decoration: 'Name decoration',
  profile_icon: 'Profile icon',
  title: 'Title',
  theme: 'Theme'
};

const inputStyle: React.CSSProperties = {
  padding: '0.5rem',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--text-primary)'
};

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
  fontSize: '0.78rem',
  color: 'var(--text-secondary)'
};

const NameColorSwatch: React.FC<{ value: string; size?: string }> = ({ value, size = '3rem' }) => {
  const parsed = parseNameColor(value);
  return (
    <span
      aria-hidden="true"
      data-name-color-preview={value}
      style={{
        display: 'block',
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-color)',
        backgroundColor: parsed.color,
        backgroundImage: parsed.backgroundImage
      }}
    />
  );
};

const defaultValueFor = (kind: ShopKind): string => {
  if (kind === 'piece_skin') return 'classic';
  if (kind === 'name_color') return '#22d3ee';
  if (kind === 'name_decoration') return '';
  if (kind === 'profile_icon') return '';
  return '';
};

const createEmptyForm = (kind: ShopKind): ShopForm => ({
  name: '',
  name_fr: '',
  name_de: '',
  name_es: '',
  name_it: '',
  value: defaultValueFor(kind),
  mode: 'dark',
  palette: { ...DEFAULT_THEME_PREVIEW },
  html: kind === 'name_decoration' ? '{name}' : '',
  price: 0,
  sort_order: 0,
  active: true
});

const THEME_PALETTE_FIELDS: Array<{
  key: Exclude<keyof ThemePreview, 'shadow'>;
  label: string;
  group: 'surfaces' | 'borders' | 'text' | 'accents';
}> = [
  { key: 'bgPrimary', label: 'Background', group: 'surfaces' },
  { key: 'bgSecondary', label: 'Secondary background', group: 'surfaces' },
  { key: 'bgTertiary', label: 'Tertiary background', group: 'surfaces' },
  { key: 'bgCard', label: 'Card background', group: 'surfaces' },
  { key: 'borderColor', label: 'Border', group: 'borders' },
  { key: 'borderFocus', label: 'Focus border', group: 'borders' },
  { key: 'textPrimary', label: 'Primary text', group: 'text' },
  { key: 'textSecondary', label: 'Secondary text', group: 'text' },
  { key: 'textMuted', label: 'Muted text', group: 'text' },
  { key: 'accentCyan', label: 'Cyan', group: 'accents' },
  { key: 'accentBlue', label: 'Blue', group: 'accents' },
  { key: 'accentPurple', label: 'Purple', group: 'accents' },
  { key: 'accentPink', label: 'Pink', group: 'accents' },
  { key: 'accentGreen', label: 'Green', group: 'accents' },
  { key: 'accentOrange', label: 'Orange', group: 'accents' },
  { key: 'accentRed', label: 'Red', group: 'accents' },
  { key: 'accentYellow', label: 'Yellow', group: 'accents' }
];

const THEME_GROUPS: Array<{ id: 'surfaces' | 'borders' | 'text' | 'accents'; label: string }> = [
  { id: 'surfaces', label: 'Surfaces' },
  { id: 'borders', label: 'Borders' },
  { id: 'text', label: 'Text colors' },
  { id: 'accents', label: 'Accents' }
];

const isHexColor = (value: string): boolean => /^#[0-9a-f]{6}$/i.test(value);

const ThemeColorField: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => (
  <label style={fieldStyle}>
    {label}
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
      {isHexColor(value) ? (
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
          style={{ width: '34px', height: '32px', padding: '0.15rem', flexShrink: 0, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
        />
      ) : (
        <span aria-hidden="true" style={{ width: '34px', height: '32px', flexShrink: 0, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', background: value }} />
      )}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        spellCheck={false}
        style={{ ...inputStyle, flex: 1, minWidth: 0, fontFamily: 'monospace', fontSize: '0.72rem' }}
      />
    </div>
  </label>
);

const ThemePaletteEditor: React.FC<{
  palette: ThemePreview;
  onChange: (palette: ThemePreview) => void;
}> = ({ palette, onChange }) => {
  const { t } = useI18n();
  const update = (key: keyof ThemePreview, value: string) => onChange({ ...palette, [key]: value });

  return (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '0.7rem', padding: '0.9rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
      <strong style={{ fontSize: '0.85rem' }}>{t('Theme colors')}</strong>
      {THEME_GROUPS.map((group) => (
        <div key={group.id}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t(group.label)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.55rem' }}>
            {THEME_PALETTE_FIELDS.filter((field) => field.group === group.id).map((field) => (
              <ThemeColorField
                key={field.key}
                label={t(field.label)}
                value={palette[field.key]}
                onChange={(value) => update(field.key, value)}
              />
            ))}
          </div>
        </div>
      ))}
      <label style={fieldStyle}>
        {t('Shadow')}
        <input
          value={palette.shadow}
          onChange={(event) => update('shadow', event.target.value)}
          spellCheck={false}
          style={{ ...inputStyle, fontFamily: 'monospace', fontSize: '0.72rem' }}
        />
      </label>
    </div>
  );
};

export const AdminShopSection: React.FC<AdminShopSectionProps> = ({ kind }) => {
  const { t, language } = useI18n();
  const { refresh: refreshDecorations } = useNameDecorations();
  const [items, setItems] = useState<AdminShopItem[]>([]);
  const [form, setForm] = useState<ShopForm>(() => createEmptyForm(kind));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState(0);
  const [savingPrice, setSavingPrice] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isIcon = kind === 'profile_icon';
  const canCreate = kind !== 'piece_skin';
  const localizedFormName = language === 'fr' ? form.name_fr
    : language === 'de' ? form.name_de
      : language === 'es' ? form.name_es
        : language === 'it' ? form.name_it
          : form.name;
  const decorationPreviewName = localizedFormName.trim() || form.name.trim() || t('Name decoration');

  const loadItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ApiClient.adminGetShopItems();
      setItems((result || []).filter((item: AdminShopItem) => item.kind === kind));
    } catch (e: any) {
      setError(e?.message || t('Failed to load shop'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setForm(createEmptyForm(kind));
    setEditingId(null);
    setEditingPriceId(null);
    setMessage(null);
    void loadItems();
  }, [kind]);

  const resetForm = () => {
    setForm(createEmptyForm(kind));
    setEditingId(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    const value = form.value.trim();
    const payload = {
      kind,
      name: isIcon ? value : form.name.trim(),
      name_fr: isIcon ? '' : form.name_fr.trim(),
      name_de: isIcon ? '' : form.name_de.trim(),
      name_es: isIcon ? '' : form.name_es.trim(),
      name_it: isIcon ? '' : form.name_it.trim(),
      value,
      mode: kind === 'theme' ? form.mode : undefined,
      palette: kind === 'theme' ? form.palette : undefined,
      html: kind === 'name_decoration' ? form.html : undefined,
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
      if (kind === 'name_decoration') await refreshDecorations();
    } catch (e: any) {
      setError(e?.message || t('Failed to save shop item.'));
    } finally {
      setSaving(false);
    }
  };

  const startPriceEdit = (item: AdminShopItem) => {
    if (item.is_default) return;
    setEditingPriceId(item.id);
    setPriceDraft(item.price);
    setEditingId(null);
    setMessage(null);
    setError(null);
  };

  const cancelPriceEdit = () => {
    setEditingPriceId(null);
    setPriceDraft(0);
  };

  const savePrice = async (event: React.FormEvent, item: AdminShopItem) => {
    event.preventDefault();
    setSavingPrice(true);
    setError(null);
    setMessage(null);
    try {
      await ApiClient.adminUpdateShopItem(item.id, { price: Number(priceDraft) });
      setMessage(t('Shop item saved successfully.'));
      setEditingPriceId(null);
      await loadItems();
    } catch (e: any) {
      setError(e?.message || t('Failed to save shop item.'));
    } finally {
      setSavingPrice(false);
    }
  };

  const startEdit = (item: AdminShopItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      name_fr: item.name_fr || '',
      name_de: item.name_de || '',
      name_es: item.name_es || '',
      name_it: item.name_it || '',
      value: item.value,
      mode: item.mode === 'light' ? 'light' : 'dark',
      palette: item.palette ? { ...item.palette } : { ...DEFAULT_THEME_PREVIEW },
      html: item.kind === 'name_decoration'
        ? (item.html || getDefaultDecorationHtml(item.value))
        : '',
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
      if (editingPriceId === item.id) {
        cancelPriceEdit();
      }
      setMessage(t('Shop item deleted successfully.'));
      await loadItems();
      if (kind === 'name_decoration') await refreshDecorations();
    } catch (e: any) {
      setError(e?.message || t('Failed to delete shop item.'));
    }
  };

  return (
    <div className="panel-card" style={{ padding: '1.5rem', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
        <ShoppingBag size={20} style={{ color: 'var(--accent-cyan)' }} />
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          {t('Shop management')}
        </h2>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        {t('Manage the items available in this category.')}
      </p>

      {message && (
        <div style={{ color: 'var(--accent-green)', fontSize: '0.85rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <CheckCircle2 size={14} /> {message}
        </div>
      )}
      {error && <p style={{ color: 'var(--accent-red)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>{error}</p>}

      {!canCreate && !editingId && (
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '0.85rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem' }}>
          {t('Adding new items is disabled for this category. Existing items can still be edited.')}
        </p>
      )}

      {(canCreate || editingId) && (
        <form
          onSubmit={submit}
          style={{ display: 'grid', gridTemplateColumns: isIcon ? 'repeat(auto-fit, minmax(120px, 1fr))' : 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem', padding: '1rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem' }}
        >
          {isIcon ? (
            <label style={fieldStyle}>
              {t('Emoji')}
              <input
                required
                maxLength={16}
                placeholder="😀"
                value={form.value}
                onChange={(event) => setForm({ ...form, value: event.target.value })}
                style={{ ...inputStyle, fontSize: '1.25rem', textAlign: 'center' }}
              />
            </label>
          ) : (
            <>
              <label style={fieldStyle}>
                {t('Name (English)')}
                <input lang="en" required minLength={2} maxLength={48} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} style={inputStyle} />
              </label>

              <label style={fieldStyle}>
                {t('Name (French)')}
                <input lang="fr" maxLength={48} value={form.name_fr} onChange={(event) => setForm({ ...form, name_fr: event.target.value })} style={inputStyle} />
              </label>

              <label style={fieldStyle}>
                {t('Name (German)')}
                <input lang="de" maxLength={48} value={form.name_de} onChange={(event) => setForm({ ...form, name_de: event.target.value })} style={inputStyle} />
              </label>

              <label style={fieldStyle}>
                {t('Name (Spanish)')}
                <input lang="es" maxLength={48} value={form.name_es} onChange={(event) => setForm({ ...form, name_es: event.target.value })} style={inputStyle} />
              </label>

              <label style={fieldStyle}>
                {t('Name (Italian)')}
                <input lang="it" maxLength={48} value={form.name_it} onChange={(event) => setForm({ ...form, name_it: event.target.value })} style={inputStyle} />
              </label>

              <p style={{ gridColumn: '1 / -1', fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                {t('Leave a translation empty to use the English name.')}
              </p>

              <label style={fieldStyle}>
                {t('Item value')}
                {kind === 'piece_skin' ? (
                  <select value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} style={inputStyle}>
                    {PIECE_SKINS.map((option) => <option key={option} value={option}>{getPieceSkinLabel(option, language)}</option>)}
                  </select>
                ) : kind === 'name_decoration' ? (
                  <>
                    <input
                      value={form.value}
                      disabled={Boolean(editingId)}
                      onChange={(event) => setForm({ ...form, value: event.target.value.toLowerCase() })}
                      placeholder="my-decoration"
                      pattern="[a-z0-9][a-z0-9_-]{1,31}"
                      spellCheck={false}
                      style={{ ...inputStyle, opacity: editingId ? 0.65 : 1 }}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {t('Leave blank to generate an ID.')}
                    </span>
                  </>
                ) : kind === 'theme' ? (
                  <>
                    <input
                      value={form.value}
                      disabled={Boolean(editingId)}
                      onChange={(event) => setForm({ ...form, value: event.target.value.toLowerCase() })}
                      placeholder="my-theme"
                      pattern="[a-z0-9][a-z0-9-]{2,47}"
                      spellCheck={false}
                      style={{ ...inputStyle, opacity: editingId ? 0.65 : 1 }}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {t('Leave blank to generate an ID.')}
                    </span>
                  </>
                ) : kind === 'name_color' ? (
                  form.value.startsWith('gradient:') ? (
                    <input
                      required
                      value={form.value}
                      onChange={(event) => setForm({ ...form, value: event.target.value })}
                      placeholder="gradient:90:#ff0080,#00e5ff"
                      style={inputStyle}
                    />
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="color"
                        value={form.value}
                        onChange={(event) => setForm({ ...form, value: event.target.value })}
                        style={{ ...inputStyle, height: '36px', padding: '0.2rem' }}
                      />
                      <input
                        required
                        value={form.value}
                        onChange={(event) => setForm({ ...form, value: event.target.value })}
                        placeholder="#22d3ee or gradient:90:#ff0080,#00e5ff"
                        style={{ ...inputStyle, flex: 1 }}
                      />
                    </div>
                  )
                ) : (
                  <input required maxLength={40} value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} style={inputStyle} />
                )}
              </label>

              {kind === 'theme' && (
                <label style={fieldStyle}>
                  {t('Theme mode')}
                  <select value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value === 'light' ? 'light' : 'dark' })} style={inputStyle}>
                    <option value="dark">{t('Dark')}</option>
                    <option value="light">{t('Light')}</option>
                  </select>
                </label>
              )}

              {kind === 'theme' && (
                <ThemePaletteEditor
                  palette={form.palette}
                  onChange={(palette) => setForm({ ...form, palette })}
                />
              )}

              {kind === 'name_decoration' && (
                <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  <label style={fieldStyle}>
                    {t('Decoration HTML')}
                    <textarea
                      value={form.html}
                      onChange={(event) => setForm({ ...form, html: event.target.value })}
                      rows={7}
                      spellCheck={false}
                      placeholder={'<span style="text-shadow: 0 0 8px {color}">{name}</span>'}
                      style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.73rem', lineHeight: 1.5, minHeight: '150px' }}
                    />
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', padding: '0.8rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {t('Decoration preview')}
                    </span>
                    <div style={{ minHeight: '72px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.7rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box', overflow: 'auto' }}>
                      <UserName
                        displayName={decorationPreviewName}
                        cosmetics={{ name_decoration: form.value || 'none', name_color: '#f8fafc' }}
                        decorationHtml={form.html}
                        showTitle={false}
                        showIcon={false}
                        size="1.05rem"
                        align="center"
                      />
                    </div>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      {t('Use {name} for the player name and {color} for the name color.')}
                    </p>
                  </div>
                </div>
              )}

              {kind === 'name_color' && (
                <div
                  style={{
                    gridColumn: '1 / -1',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.9rem',
                    padding: '0.7rem 0.8rem',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)'
                  }}
                >
                  <NameColorSwatch value={form.value} size="72px" />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                      {t('Color preview')}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>
                      {form.value || '—'}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <label style={fieldStyle}>
            {t('Price')}
            <input type="number" min={0} max={1000000} value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} style={inputStyle} />
          </label>

          <label style={fieldStyle}>
            {t('Sort order')}
            <input type="number" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: Number(event.target.value) })} style={inputStyle} />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', color: 'var(--text-secondary)', alignSelf: 'end', paddingBottom: '0.5rem' }}>
            <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
            {t('Active')}
          </label>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'end', paddingBottom: '0.05rem' }}>
            <button type="submit" className="btn-primary" disabled={saving} style={{ padding: '0.5rem 0.9rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Plus size={14} /> {saving ? t('Saving...') : editingId ? t('Save item') : isIcon ? t('Add icon') : kind === 'theme' ? t('Add theme') : kind === 'name_decoration' ? t('Add decoration') : t('Add item')}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary" onClick={resetForm} style={{ padding: '0.5rem 0.9rem', fontSize: '0.82rem' }}>
                {t('Cancel')}
              </button>
            )}
          </div>
        </form>
      )}

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('Loading...')}</div>
      ) : items.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.25rem' }}>
          {t('No items in this category yet.')}
        </div>
      ) : isIcon ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: '0.55rem' }}>
          {items.map((item) => editingPriceId === item.id ? (
            <form
              key={item.id}
              onSubmit={(event) => void savePrice(event, item)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 0.35rem', background: 'var(--bg-tertiary)', border: '1px solid var(--accent-cyan)', borderRadius: 'var(--radius-sm)' }}
            >
              <span data-profile-icon={item.value} aria-hidden="true" style={{ fontSize: '1.55rem', lineHeight: 1.15 }}>
                {getProfileIconEmoji(item.value)}
              </span>
              <input
                type="number"
                min={0}
                max={1000000}
                value={priceDraft}
                onChange={(event) => setPriceDraft(Number(event.target.value))}
                aria-label={t('Price')}
                autoFocus
                style={{ width: '100%', minWidth: 0, padding: '0.2rem', textAlign: 'center', fontSize: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}
              />
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                <button
                  type="submit"
                  disabled={savingPrice}
                  aria-label={t('Save item')}
                  title={t('Save item')}
                  style={{ padding: '0.2rem', background: 'var(--bg-secondary)', color: 'var(--accent-green)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', cursor: savingPrice ? 'wait' : 'pointer', display: 'flex' }}
                >
                  <Check size={12} />
                </button>
                <button
                  type="button"
                  onClick={cancelPriceEdit}
                  aria-label={t('Cancel')}
                  title={t('Cancel')}
                  style={{ padding: '0.2rem', background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex' }}
                >
                  <X size={12} />
                </button>
              </div>
            </form>
          ) : (
            <div
              key={item.id}
              title={item.active ? t('Active') : t('Inactive')}
              style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', padding: '0.55rem 0.35rem 0.4rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', opacity: item.active ? 1 : 0.45 }}
            >
              <button
                type="button"
                onClick={() => startPriceEdit(item)}
                disabled={Boolean(item.is_default)}
                aria-label={t('Edit')}
                title={item.is_default ? t('Default shop items cannot be edited or deleted.') : t('Edit')}
                style={{ position: 'absolute', top: '0.15rem', left: '0.15rem', padding: '0.18rem', background: 'transparent', color: 'var(--text-secondary)', border: 0, cursor: item.is_default ? 'not-allowed' : 'pointer', opacity: item.is_default ? 0.2 : 0.65, display: 'flex' }}
              >
                <Edit size={11} />
              </button>
              <span
                data-profile-icon={item.value}
                aria-hidden="true"
                style={{ fontSize: '1.7rem', lineHeight: 1.15 }}
              >
                {getProfileIconEmoji(item.value)}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {item.price} {t('Credits')}
              </span>
              <button
                type="button"
                onClick={() => void remove(item)}
                disabled={Boolean(item.is_default)}
                aria-label={t('Delete')}
                title={item.is_default ? t('Default shop items cannot be edited or deleted.') : t('Delete')}
                style={{ position: 'absolute', top: '0.15rem', right: '0.15rem', padding: '0.18rem', background: 'transparent', color: 'var(--accent-red)', border: 0, cursor: item.is_default ? 'not-allowed' : 'pointer', opacity: item.is_default ? 0.25 : 0.75, display: 'flex' }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.55rem' }}>
          {items.map((item) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '0.7rem 0.8rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
              {item.kind === 'name_color' && <NameColorSwatch value={item.value} size="2.75rem" />}
              {item.kind === 'theme' && item.palette && (
                <div
                  aria-hidden="true"
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', width: '2.75rem', height: '2.75rem', flexShrink: 0, overflow: 'hidden', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
                >
                  {[item.palette.bgPrimary, item.palette.bgSecondary, item.palette.accentCyan, item.palette.accentPurple, item.palette.accentPink, item.palette.accentGreen].map((color, index) => (
                    <span key={`${color}-${index}`} style={{ background: color }} />
                  ))}
                </div>
              )}
              <div style={{ flex: 1, minWidth: '150px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {item.kind === 'name_decoration' ? (
                    <UserName
                      displayName={getShopItemDisplayName(item, language)}
                      cosmetics={{ name_decoration: item.value, name_color: '#f8fafc' }}
                      decorationHtml={item.html || undefined}
                      showTitle={false}
                      showIcon={false}
                      size="0.95rem"
                    />
                  ) : (
                    <strong style={{ fontSize: '0.88rem' }}>
                      {getShopItemDisplayName(item, language)}
                    </strong>
                  )}
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
                  disabled={Boolean(item.is_default) && item.kind !== 'theme' && item.kind !== 'name_decoration'}
                  title={Boolean(item.is_default) && item.kind !== 'theme' && item.kind !== 'name_decoration' ? t('Default shop items cannot be edited or deleted.') : t('Edit')}
                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', cursor: Boolean(item.is_default) && item.kind !== 'theme' && item.kind !== 'name_decoration' ? 'not-allowed' : 'pointer', opacity: Boolean(item.is_default) && item.kind !== 'theme' && item.kind !== 'name_decoration' ? 0.45 : 1, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
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
