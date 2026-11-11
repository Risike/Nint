import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronRight, Coins, Palette, ShoppingBag, Sparkles, Tag, Type } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/useI18n';
import { ApiClient } from '../services/api';
import { CanvasRenderer } from '../game/rendering/canvasRenderer';
import { normalizePieceSkin } from '../game/rendering/pieceSkins';
import { UserName } from '../components/user/UserName';
import { getShopTitleLabel } from '../i18n/titles';
import { getShopItemLabel } from '../i18n/shopItems';

interface ShopPageProps {
  onNavigate: (tab: string) => void;
}

type ShopKind = 'piece_skin' | 'name_color' | 'name_decoration' | 'title';

interface ShopItem {
  id: string;
  kind: ShopKind;
  name: string;
  value: string;
  price: number;
  is_default: number;
  owned: boolean;
  equipped: boolean;
  sort_order: number;
}

interface ShopCosmetics {
  piece_skin: string;
  name_color: string;
  name_decoration: string;
  title: string;
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
  }
];

const categoryCardStyle: React.CSSProperties = {
  padding: '1.15rem',
  cursor: 'pointer',
  transition: 'transform 0.2s',
  gap: '0.75rem'
};

const isItemEquipped = (item: ShopItem, cosmetics: ShopCosmetics): boolean => {
  if (item.kind === 'piece_skin') return cosmetics.piece_skin === item.value;
  if (item.kind === 'name_color') return cosmetics.name_color === item.value;
  if (item.kind === 'name_decoration') return cosmetics.name_decoration === item.value;
  return cosmetics.title === item.value;
};

const SkinPreview: React.FC<{ skin: string }> = ({ skin }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      CanvasRenderer.renderPreview(canvasRef.current, 'T', 24, normalizePieceSkin(skin));
    }
  }, [skin]);

  return <canvas ref={canvasRef} style={{ width: '72px', height: '72px' }} />;
};

const ItemPreview: React.FC<{ item: ShopItem; cosmetics: ShopCosmetics; displayName: string }> = ({
  item,
  cosmetics,
  displayName
}) => {
  if (item.kind === 'piece_skin') {
    return (
      <div style={{ minHeight: '76px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <SkinPreview skin={item.value} />
      </div>
    );
  }

  const previewCosmetics = {
    ...cosmetics,
    ...(item.kind === 'name_color' ? { name_color: item.value } : {}),
    ...(item.kind === 'name_decoration' ? { name_decoration: item.value } : {}),
    ...(item.kind === 'title' ? { title: item.value } : {})
  };

  return (
    <div style={{ minHeight: '76px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.5rem 0' }}>
      <UserName displayName={displayName || 'Player'} cosmetics={previewCosmetics} size="1.15rem" align="center" />
    </div>
  );
};

export const ShopPage: React.FC<ShopPageProps> = ({ onNavigate }) => {
  const { user, isAuthenticated, refreshProfile } = useAuth();
  const { t, language } = useI18n();
  const [data, setData] = useState<ShopData | null>(null);
  const [activeCategory, setActiveCategory] = useState<ShopKind | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
      setMessage(t('Item equipped!'));
    } catch (e: any) {
      setError(e?.message || t('Equip failed'));
    } finally {
      setBusyId(null);
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

  return (
    <div style={{ width: '100%', maxWidth: '1040px', padding: '0 1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.4rem' }}>{t('Shop')}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          {activeCategory
            ? t('Customize your profile with credits earned from cleared lines.')
            : t('Choose a category to browse and equip your cosmetics.')}
        </p>
      </div>

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

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', textAlign: 'left' }}>
            <div style={{ background: activeMeta.background, color: activeMeta.color, padding: '0.6rem', borderRadius: 'var(--radius-sm)', display: 'flex' }}>
              {activeMeta.icon}
            </div>
            <div>
              <h2 id="shop-selected-category" style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0 }}>
                {t(activeMeta.label)}
              </h2>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                {t('{count} items', { count: activeItems.length })}
              </span>
            </div>
          </div>

          {activeItems.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.75rem 0' }}>
              {t('No items available in this category yet.')}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: '0.9rem' }}>
              {activeItems.map((item) => {
                const canAfford = (data?.credits ?? 0) >= item.price;
                const isBusy = busyId === item.id;
                return (
                  <div key={item.id} className="panel-card" style={{ padding: '1rem', gap: '0.55rem', position: 'relative' }}>
                    {item.is_default === 1 && (
                      <span style={{ position: 'absolute', top: '0.65rem', right: '0.65rem', fontSize: '0.62rem', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: '999px', padding: '0.12rem 0.4rem' }}>
                        {t('Default item')}
                      </span>
                    )}
                    <ItemPreview item={item} cosmetics={data?.cosmetics || { piece_skin: 'classic', name_color: '#f8fafc', name_decoration: 'none', title: '' }} displayName={user?.display_name || ''} />
                    <div style={{ fontWeight: 750, fontSize: '0.98rem' }}>
                      {item.kind === 'title' ? getShopTitleLabel(item.id, item.value, language) : getShopItemLabel(item.id, item.name, language)}
                    </div>
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
        <section aria-label={t('Shop')}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(215px, 1fr))', gap: '0.9rem' }}>
            {KIND_META.map(({ kind, label, icon, color, background }) => {
              const count = data?.items.filter((item) => item.kind === kind).length || 0;
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
