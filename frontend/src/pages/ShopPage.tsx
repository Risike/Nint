import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronRight, Coins, Eye, Palette, ShoppingBag, Smile, Sparkles, Sun, Tag, Type, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/useI18n';
import { ApiClient } from '../services/api';
import { CanvasRenderer } from '../game/rendering/canvasRenderer';
import { normalizePieceSkin } from '../game/rendering/pieceSkins';
import type { TetrominoType } from '../game/engine/constants';
import { UserName } from '../components/user/UserName';
import { getShopItemDisplayName } from '../i18n/shopItems';
import { getProfileIconEmoji } from '../i18n/profileIcons';
import { getThemePreview, type ThemePreview as ThemePreviewPalette } from '../i18n/themes';
import { useSettings } from '../context/SettingsContext';
import { useGamepadBack } from '../context/GamepadNavContext';

interface ShopPageProps {
  onNavigate: (tab: string) => void;
  mode?: 'shop' | 'player';
  onBack?: () => void;
}

type ShopKind = 'piece_skin' | 'name_color' | 'name_decoration' | 'profile_icon' | 'title' | 'theme';

interface ShopItem {
  id: string;
  kind: ShopKind;
  name: string;
  name_fr?: string | null;
  name_de?: string | null;
  name_es?: string | null;
  name_it?: string | null;
  value: string;
  price: number;
  is_default: number;
  owned: boolean;
  equipped: boolean;
  sort_order: number;
  mode?: 'dark' | 'light';
  palette?: ThemePreviewPalette | null;
  html?: string | null;
}

interface ShopCosmetics {
  piece_skin: string;
  name_color: string;
  name_decoration: string;
  profile_icon: string;
  title: string;
  theme: string;
}

interface ShopData {
  credits: number;
  cosmetics: ShopCosmetics;
  items: ShopItem[];
}

const KIND_META: Array<{
  kind: ShopKind;
  label: string;
  icon: React.ReactNode;
  color: string;
  background: string;
}> = [
  {
    kind: 'piece_skin',
    label: 'Piece Skins',
    icon: <Palette size={22} />,
    color: 'var(--accent-cyan)',
    background: 'rgba(6, 182, 212, 0.2)'
  },
  {
    kind: 'title',
    label: 'Titles',
    icon: <Type size={22} />,
    color: 'var(--accent-yellow)',
    background: 'rgba(234, 179, 8, 0.2)'
  },
  {
    kind: 'theme',
    label: 'Themes',
    icon: <Sun size={22} />,
    color: 'var(--accent-orange)',
    background: 'rgba(249, 115, 22, 0.2)'
  },
  {
    kind: 'name_color',
    label: 'Name Colors',
    icon: <Sparkles size={22} />,
    color: 'var(--accent-pink)',
    background: 'rgba(236, 72, 153, 0.2)'
  },
  {
    kind: 'name_decoration',
    label: 'Name Decorations',
    icon: <Tag size={22} />,
    color: 'var(--accent-purple)',
    background: 'rgba(168, 85, 247, 0.2)'
  },
  {
    kind: 'profile_icon',
    label: 'Profile Icons',
    icon: <Smile size={22} />,
    color: 'var(--accent-green)',
    background: 'rgba(34, 197, 94, 0.2)'
  }
];

const categoryCardStyle: React.CSSProperties = {
  padding: '1.15rem',
  cursor: 'pointer',
  transition: 'transform 0.2s',
  gap: '0.75rem'
};

const PREVIEW_PIECES: TetrominoType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

const isItemEquipped = (item: ShopItem, cosmetics: ShopCosmetics): boolean => {
  if (item.kind === 'piece_skin') return cosmetics.piece_skin === item.value;
  if (item.kind === 'name_color') return cosmetics.name_color === item.value;
  if (item.kind === 'name_decoration') return cosmetics.name_decoration === item.value;
  if (item.kind === 'profile_icon') return cosmetics.profile_icon === item.value;
  if (item.kind === 'theme') return cosmetics.theme === item.value;
  return cosmetics.title === item.value;
};

const SkinPreview: React.FC<{ skin: string; piece: TetrominoType }> = ({ skin, piece }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      CanvasRenderer.renderPreview(canvasRef.current, piece, 24, normalizePieceSkin(skin));
    }
  }, [skin, piece]);

  return <canvas ref={canvasRef} style={{ width: '72px', height: '72px' }} />;
};

const ThemePreview: React.FC<{ value: string; palette?: ThemePreviewPalette | null }> = ({ value, palette }) => {
  const preview = palette || getThemePreview(value);
  if (!preview) return null;

  return (
    <div style={{ minHeight: '76px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        data-theme-preview={value}
        style={{
          width: '100%',
          minHeight: '66px',
          padding: '0.55rem 0.65rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '0.4rem',
          background: preview.bgPrimary,
          border: `1px solid ${preview.borderColor}`,
          borderRadius: 'var(--radius-sm)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <span style={{ color: preview.textPrimary, fontWeight: 800, fontSize: '1rem' }}>Aa</span>
          <span style={{ color: preview.textSecondary, fontSize: '0.62rem' }}>Nint</span>
        </div>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {[preview.accentCyan, preview.accentPink, preview.accentGreen, preview.accentOrange].map((color) => (
            <span key={color} style={{ height: '7px', flex: 1, borderRadius: '999px', background: color }} />
          ))}
        </div>
        <div style={{ height: '6px', borderRadius: '999px', background: preview.bgTertiary }} />
      </div>
    </div>
  );
};

const ItemPreview: React.FC<{
  item: ShopItem;
  cosmetics: ShopCosmetics;
  displayName: string;
  previewPiece: TetrominoType;
}> = ({
  item,
  cosmetics,
  displayName,
  previewPiece
}) => {
  if (item.kind === 'piece_skin') {
    return (
      <div style={{ minHeight: '76px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <SkinPreview skin={item.value} piece={previewPiece} />
      </div>
    );
  }

  if (item.kind === 'profile_icon') {
    return (
      <div style={{ minHeight: '76px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span
          data-profile-icon={item.value}
          aria-hidden="true"
          style={{ fontSize: '2.6rem', lineHeight: 1 }}
        >
          {getProfileIconEmoji(item.value)}
        </span>
      </div>
    );
  }

  if (item.kind === 'theme') {
    return <ThemePreview value={item.value} palette={item.palette} />;
  }

  const previewCosmetics = {
    ...cosmetics,
    ...(item.kind === 'name_color' ? { name_color: item.value } : {}),
    ...(item.kind === 'name_decoration' ? { name_decoration: item.value } : {}),
    ...(item.kind === 'title' ? { title: item.value } : {})
  };

  return (
    <div style={{ minHeight: '76px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem 0' }}>
      <UserName
        displayName={displayName || 'Player'}
        cosmetics={previewCosmetics}
        decorationHtml={item.kind === 'name_decoration' ? item.html || undefined : undefined}
        size="1.15rem"
        align="center"
      />
    </div>
  );
};

export const ShopPage: React.FC<ShopPageProps> = ({ onNavigate, mode = 'shop', onBack }) => {
  const { user, isAuthenticated, refreshProfile } = useAuth();
  const { updateSettings, setPreviewTheme } = useSettings();
  const { t, language } = useI18n();
  const [data, setData] = useState<ShopData | null>(null);
  const [activeCategory, setActiveCategory] = useState<ShopKind | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewPiece, setPreviewPiece] = useState<TetrominoType>('T');
  const [playerName, setPlayerName] = useState(user?.username || user?.display_name || '');
  const [nameBusy, setNameBusy] = useState(false);
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const isPlayerMode = mode === 'player';

  useGamepadBack(() => {
    if (activeCategory !== null) {
      setActiveCategory(null);
      return true;
    }
    if (onBack) {
      onBack();
      return true;
    }
    return false;
  }, [activeCategory, onBack]);

  const loadShop = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ApiClient.getShop();
      setData(result);
    } catch (e: any) {
      setError(e?.message || t('Failed to load shop'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      void loadShop();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    setPlayerName(user?.username || user?.display_name || '');
  }, [user?.username, user?.display_name]);

  // A preview belongs to the shop. Leaving the shop immediately restores the
  // equipped theme, including when navigation happens outside this component.
  useEffect(() => () => setPreviewTheme(null), [setPreviewTheme]);

  const purchase = async (item: ShopItem) => {
    setBusyId(item.id);
    setMessage(null);
    setError(null);
    try {
      const result = await ApiClient.purchaseShopItem(item.id);
      setData((previous) => previous ? {
        ...previous,
        credits: result.credits,
        items: previous.items.map((entry) => entry.id === item.id ? { ...entry, owned: true } : entry)
      } : previous);
      await refreshProfile().catch(() => undefined);
      setMessage(t('Item purchased!'));
    } catch (e: any) {
      setError(e?.message || t('Purchase failed'));
    } finally {
      setBusyId(null);
    }
  };

  const equip = async (item: ShopItem) => {
    setBusyId(item.id);
    setMessage(null);
    setError(null);
    try {
      const result = await ApiClient.equipShopItem(item.id);
      setData((previous) => previous ? {
        ...previous,
        cosmetics: result.cosmetics,
        items: previous.items.map((entry) => ({
          ...entry,
          equipped: isItemEquipped(entry, result.cosmetics)
        }))
      } : previous);
      await refreshProfile().catch(() => undefined);
      if (item.kind === 'theme' && result.cosmetics?.theme) {
        setPreviewTheme(null);
        updateSettings({ theme: result.cosmetics.theme });
      }
      setMessage(t('Item equipped!'));
    } catch (e: any) {
      setError(e?.message || t('Equip failed'));
    } finally {
      setBusyId(null);
    }
  };

  const savePlayerName = async (event: React.FormEvent) => {
    event.preventDefault();
    setNameMessage(null);
    setNameError(null);
    const nextName = playerName.trim();
    if (!/^[A-Za-z0-9]{3,32}$/.test(nextName)) {
      setNameError(t('Username must be 3-32 characters using only letters and numbers'));
      return;
    }
    setNameBusy(true);
    try {
      await ApiClient.updateMe({ username: nextName });
      await refreshProfile();
      setNameMessage(t('Player name updated!'));
    } catch (e: any) {
      const message = e?.message || t('Update failed');
      setNameError(
        message === 'Username is already taken'
          ? t('Username is already taken')
          : message === 'Username must be 3-32 characters using only letters and numbers'
            ? t('Username must be 3-32 characters using only letters and numbers')
            : message
      );
    } finally {
      setNameBusy(false);
    }
  };

  const selectCategory = (kind: ShopKind) => {
    setActiveCategory(kind);
    setMessage(null);
    setError(null);
  };

  const handleCategoryKey = (kind: ShopKind) => (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectCategory(kind);
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ width: '100%', maxWidth: '560px', padding: '1rem' }}>
        <div className="panel-card" style={{ padding: '2rem', textAlign: 'center', alignItems: 'center' }}>
          <ShoppingBag size={42} style={{ color: 'var(--accent-cyan)' }} />
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>{t('Shop')}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            {t('Sign in to spend credits and customize your profile.')}
          </p>
          <button className="btn-primary" onClick={() => onNavigate('login')}>
            {t('Sign In')}
          </button>
        </div>
      </div>
    );
  }

  const activeMeta = activeCategory ? KIND_META.find((entry) => entry.kind === activeCategory) : undefined;
  const activeItems = activeCategory
    ? (data?.items.filter((item) => item.kind === activeCategory) || [])
    : [];
  const visibleItems = isPlayerMode ? activeItems.filter((item) => item.owned) : activeItems;

  return (
    <div style={{ width: '100%', maxWidth: '1040px', padding: '0 1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.4rem' }}>
          {isPlayerMode ? t('Customize Player') : t('Shop')}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {isPlayerMode
            ? t('Change your player name and equip the cosmetics you own.')
            : activeCategory
              ? t('Customize your profile with credits earned from cleared lines.')
              : t('Choose a category to browse and equip your cosmetics.')}
        </p>
      </div>

      {isPlayerMode && (
        <form className="panel-card" onSubmit={savePlayerName} style={{ padding: '1.25rem', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.05rem' }}>
            <UserRound size={20} color="var(--accent-cyan)" />
            <span>{t('Change Player Name')}</span>
          </div>
          <div>
            <label htmlFor="player-name" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
              {t('Player Name')}
            </label>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'stretch' }}>
              <input
                id="player-name"
                type="text"
                required
                minLength={3}
                maxLength={32}
                pattern="[A-Za-z0-9]{3,32}"
                autoComplete="username"
                value={playerName}
                onChange={(event) => setPlayerName(event.target.value)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '0.7rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)'
                }}
              />
              <button type="submit" className="btn-primary" disabled={nameBusy} style={{ whiteSpace: 'nowrap' }}>
                {nameBusy ? t('Saving...') : t('Save')}
              </button>
            </div>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
              {t('3-32 characters, letters and numbers only. This name is unique and used to sign in.')}
            </p>
          </div>
          {nameMessage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(34, 197, 94, 0.15)', color: 'var(--accent-green)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}>
              <CheckCircle2 size={16} /> {nameMessage}
            </div>
          )}
          {nameError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-red)', padding: '0.6rem', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}>
              <AlertCircle size={16} /> {nameError}
            </div>
          )}
        </form>
      )}

      <div className="panel-card" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Coins size={22} style={{ color: 'var(--accent-yellow)' }} />
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{t('Credits')}</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-yellow)' }}>
              {(data?.credits ?? user?.credits ?? 0).toLocaleString()}
            </div>
          </div>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{t('1 credit per cleared line')}</div>
      </div>

      {message && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(34, 197, 94, 0.15)', color: 'var(--accent-green)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          <CheckCircle2 size={16} /> {message}
        </div>
      )}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-red)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>{t('Loading shop...')}</div>
      ) : activeCategory && activeMeta ? (
        <section aria-labelledby="shop-selected-category">
          <button
            className="btn-secondary"
            onClick={() => setActiveCategory(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.85rem', fontSize: '0.85rem', marginBottom: '1rem' }}
          >
            <ArrowLeft size={16} /> {t('Back to categories')}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', textAlign: 'left' }}>
            <div style={{ background: activeMeta.background, color: activeMeta.color, padding: '0.6rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
              {activeMeta.icon}
            </div>
            <div>
              <h2 id="shop-selected-category" style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>
                {t(activeMeta.label)}
              </h2>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                {t('{count} items', { count: visibleItems.length })}
              </span>
            </div>
            {activeCategory === 'piece_skin' && (
              <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {t('Preview piece')}
                <select
                  aria-label={t('Preview piece')}
                  value={previewPiece}
                  onChange={(event) => setPreviewPiece(event.target.value as TetrominoType)}
                  style={{ padding: '0.4rem 0.55rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}
                >
                  {PREVIEW_PIECES.map((piece) => <option key={piece} value={piece}>{piece}</option>)}
                </select>
              </label>
            )}
          </div>

          {visibleItems.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.75rem 0' }}>
              {isPlayerMode
                ? t('You do not own any items in this category yet.')
                : t('No items available in this category yet.')}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: '0.9rem' }}>
              {visibleItems.map((item) => {
                const canAfford = (data?.credits ?? 0) >= item.price;
                const isBusy = busyId === item.id;
                return (
                  <div key={item.id} className="panel-card" style={{ padding: '1rem', paddingTop: item.is_default === 1 ? '2.2rem' : '1rem', gap: '0.55rem', position: 'relative' }}>
                    {item.is_default === 1 && (
                      <span style={{ position: 'absolute', top: '0.65rem', right: '0.65rem', fontSize: '0.62rem', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '999px', padding: '0.12rem 0.4rem' }}>
                        {t('Default item')}
                      </span>
                    )}
                    <ItemPreview item={item} cosmetics={data?.cosmetics || { piece_skin: 'classic', name_color: '#f8fafc', name_decoration: 'none', profile_icon: 'user', title: '', theme: 'dark-01' }} displayName={user?.display_name || ''} previewPiece={previewPiece} />
                    {item.kind !== 'profile_icon' && (
                      <div style={{ fontWeight: 750, fontSize: '0.98rem' }}>
                        {getShopItemDisplayName(item, language)}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.15rem' }}>
                      <span style={{ color: item.owned ? 'var(--text-muted)' : 'var(--accent-yellow)', fontWeight: 700, fontSize: '0.82rem' }}>
                        {item.owned ? t('Owned') : item.price === 0 ? t('Free') : `${item.price} ${t('Credits')}`}
                      </span>
                      <button
                        className={item.equipped ? 'btn-secondary' : 'btn-primary'}
                        disabled={isBusy || item.equipped || (!item.owned && !canAfford)}
                        onClick={() => item.owned ? void equip(item) : void purchase(item)}
                        style={{ padding: '0.38rem 0.8rem', fontSize: '0.8rem' }}
                      >
                        {isBusy ? t('Loading...') : item.equipped ? t('Equipped') : item.owned ? t('Equip') : t('Buy')}
                      </button>
                    </div>
                    {item.kind === 'theme' && (
                      <button
                        type="button"
                        className="btn-secondary"
                        data-theme-preview-action={item.value}
                        onClick={() => setPreviewTheme(item.value)}
                        style={{
                          width: '100%',
                          padding: '0.38rem 0.8rem',
                          fontSize: '0.78rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.35rem'
                        }}
                      >
                        <Eye size={14} aria-hidden="true" /> {t('Preview')}
                      </button>
                    )}
                    {!item.owned && !canAfford && (
                      <div style={{ color: 'var(--accent-red)', fontSize: '0.72rem' }}>{t('Not enough credits')}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section aria-label={isPlayerMode ? t('Customize Player') : t('Shop')}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: '0.9rem' }}>
            {KIND_META.map(({ kind, label, icon, color, background }) => {
              const count = data?.items.filter((item) => item.kind === kind && (!isPlayerMode || item.owned)).length || 0;
              return (
                <div
                  key={kind}
                  className="panel-card"
                  role="button"
                  tabIndex={0}
                  style={categoryCardStyle}
                  onClick={() => selectCategory(kind)}
                  onKeyDown={handleCategoryKey(kind)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', textAlign: 'left' }}>
                    <div style={{ background, color, padding: '0.6rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
                      {icon}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0 }}>{t(label)}</h3>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                        {t('{count} items', { count })}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', color, fontSize: '0.8rem', fontWeight: 700 }}>
                    <span>{t('Browse')}</span>
                    <ChevronRight size={18} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
