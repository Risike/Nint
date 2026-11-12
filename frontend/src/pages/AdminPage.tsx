import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Boxes,
  Megaphone,
  Palette,
  Shield,
  ShoppingBag,
  Smile,
  Sparkles,
  Sun,
  Tags,
  Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../i18n/useI18n';
import { AdminAnnouncementsSection } from '../components/admin/AdminAnnouncementsSection';
import { AdminLeaderboardsSection } from '../components/admin/AdminLeaderboardsSection';
import { AdminShopSection, type ShopKind } from '../components/admin/AdminShopSection';
import { AdminUsersSection } from '../components/admin/AdminUsersSection';

interface AdminPageProps {
  onNavigate?: (tab: string) => void;
}

type AdminView = 'menu' | 'announcements' | 'leaderboards' | 'shop' | 'shop-category' | 'users';

interface AdminCategoryCard {
  id: Exclude<AdminView, 'menu' | 'shop-category'>;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  background: string;
}

interface ShopCategoryCard {
  kind: ShopKind;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  background: string;
}

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.9rem',
  padding: '1.25rem',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-lg)',
  textAlign: 'left'
};

const sectionTitleStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.55rem',
  fontSize: '1.15rem',
  fontWeight: 800
};

const cardStyle: React.CSSProperties = {
  padding: '1.15rem',
  cursor: 'pointer',
  alignItems: 'flex-start',
  textAlign: 'left',
  transition: 'transform 0.2s'
};

const pageTitleStyle: React.CSSProperties = {
  fontSize: '2.25rem',
  fontWeight: 800,
  marginBottom: '0.4rem'
};

const handleCardKey = (action: () => void) => (event: React.KeyboardEvent<HTMLDivElement>) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
};

export const AdminPage: React.FC<AdminPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { t } = useI18n();
  const [view, setView] = useState<AdminView>('menu');
  const [shopKind, setShopKind] = useState<ShopKind>('piece_skin');

  useEffect(() => {
    if (user && !user.is_admin) {
      onNavigate?.('home');
    }
  }, [user, onNavigate]);

  if (!user?.is_admin) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <Shield size={48} style={{ color: 'var(--accent-red)', marginBottom: '1rem' }} />
        <h2 style={{ color: 'var(--text-primary)' }}>{t('Access Denied')}</h2>
        <p style={{ color: 'var(--text-muted)' }}>{t('You must have administrator privileges to view this page.')}</p>
      </div>
    );
  }

  const adminCategories: AdminCategoryCard[] = [
    {
      id: 'announcements',
      title: t('Announcements'),
      description: t('Manage the homepage banner shown to all players.'),
      icon: <Megaphone size={22} />,
      color: 'var(--accent-cyan)',
      background: 'rgba(6, 182, 212, 0.2)'
    },
    {
      id: 'leaderboards',
      title: t('Leaderboards'),
      description: t('View world leaderboards and reset scores.'),
      icon: <BarChart3 size={22} />,
      color: 'var(--accent-yellow)',
      background: 'rgba(234, 179, 8, 0.2)'
    },
    {
      id: 'shop',
      title: t('Shop'),
      description: t('Manage skins, themes, titles, name colors, name decorations and profile icons.'),
      icon: <ShoppingBag size={22} />,
      color: 'var(--accent-pink)',
      background: 'rgba(236, 72, 153, 0.2)'
    },
    {
      id: 'users',
      title: t('Users'),
      description: t('Search users, reset their stats or delete their accounts.'),
      icon: <Users size={22} />,
      color: 'var(--accent-blue)',
      background: 'rgba(59, 130, 246, 0.2)'
    }
  ];

  const shopCategories: ShopCategoryCard[] = [
    {
      kind: 'piece_skin',
      title: t('Piece Skins'),
      description: t('Change the appearance of falling pieces.'),
      icon: <Boxes size={22} />,
      color: 'var(--accent-cyan)',
      background: 'rgba(6, 182, 212, 0.2)'
    },
    {
      kind: 'title',
      title: t('Titles'),
      description: t('Choose the title shown under player names.'),
      icon: <Tags size={22} />,
      color: 'var(--accent-yellow)',
      background: 'rgba(234, 179, 8, 0.2)'
    },
    {
      kind: 'theme',
      title: t('Themes'),
      description: t('Choose the visual theme used across the game.'),
      icon: <Sun size={22} />,
      color: 'var(--accent-orange)',
      background: 'rgba(249, 115, 22, 0.2)'
    },
    {
      kind: 'name_color',
      title: t('Name Colors'),
      description: t('Choose the color used for player names.'),
      icon: <Palette size={22} />,
      color: 'var(--accent-pink)',
      background: 'rgba(236, 72, 153, 0.2)'
    },
    {
      kind: 'name_decoration',
      title: t('Name Decorations'),
      description: t('Choose the decoration shown around player names.'),
      icon: <Sparkles size={22} />,
      color: 'var(--accent-purple)',
      background: 'rgba(168, 85, 247, 0.2)'
    },
    {
      kind: 'profile_icon',
      title: t('Profile Icons'),
      description: t('Choose the icon shown next to player names.'),
      icon: <Smile size={22} />,
      color: 'var(--accent-green)',
      background: 'rgba(34, 197, 94, 0.2)'
    }
  ];

  const openCategory = (category: AdminCategoryCard) => {
    if (category.id === 'shop') {
      setView('shop');
      return;
    }
    setView(category.id);
  };

  const openShopCategory = (kind: ShopKind) => {
    setShopKind(kind);
    setView('shop-category');
  };

  const selectedShopCategory = shopCategories.find((category) => category.kind === shopKind) || shopCategories[0];

  const renderCategoryGrid = (categories: AdminCategoryCard[] | ShopCategoryCard[], onSelect: (category: any) => void) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '0.85rem' }}>
      {categories.map((category) => (
        <div
          key={'id' in category ? category.id : category.kind}
          className="panel-card"
          role="button"
          tabIndex={0}
          style={cardStyle}
          onClick={() => onSelect(category)}
          onKeyDown={handleCardKey(() => onSelect(category))}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.55rem' }}>
            <div
              style={{
                background: category.background,
                color: category.color,
                padding: '0.5rem',
                borderRadius: 'var(--radius-sm)',
                display: 'flex'
              }}
            >
              {category.icon}
            </div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800 }}>{category.title}</h3>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            {category.description}
          </p>
        </div>
      ))}
    </div>
  );

  const renderMenu = () => (
    <>
      <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
        <div
          style={{
            width: '52px',
            height: '52px',
            margin: '0 auto 0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            color: 'var(--accent-cyan)',
            background: 'rgba(6, 182, 212, 0.15)',
            border: '1px solid rgba(6, 182, 212, 0.3)'
          }}
        >
          <Shield size={28} />
        </div>
        <h1 style={pageTitleStyle}>{t('Admin Panel')}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          {t('Platform configuration, user management, and leaderboard controls')}
        </p>
      </div>

      <section style={sectionStyle} aria-labelledby="admin-categories-heading">
        <div>
          <h2 id="admin-categories-heading" style={sectionTitleStyle}>
            <Shield size={20} color="var(--accent-cyan)" />
            {t('Administration')}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
            {t('Choose a category to manage.')}
          </p>
        </div>
        {renderCategoryGrid(adminCategories, openCategory)}
      </section>
    </>
  );

  const renderShopMenu = () => (
    <>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => setView('menu')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.5rem 0.9rem',
          fontSize: '0.82rem',
          marginBottom: '1.25rem'
        }}
      >
        <ArrowLeft size={15} /> {t('Back to admin menu')}
      </button>

      <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
        <h1 style={pageTitleStyle}>{t('Shop')}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          {t('Manage skins, themes, titles, name colors, name decorations and profile icons.')}
        </p>
      </div>

      <section style={sectionStyle} aria-labelledby="admin-shop-categories-heading">
        <div>
          <h2 id="admin-shop-categories-heading" style={sectionTitleStyle}>
            <ShoppingBag size={20} color="var(--accent-pink)" />
            {t('Shop categories')}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
            {t('Choose the category you want to manage.')}
          </p>
        </div>
        {renderCategoryGrid(shopCategories, (category: ShopCategoryCard) => openShopCategory(category.kind))}
      </section>
    </>
  );

  const renderSubpage = () => {
    const isShopCategory = view === 'shop-category';
    const backLabel = isShopCategory ? t('Back to shop categories') : t('Back to admin menu');
    const backAction = isShopCategory ? () => setView('shop') : () => setView('menu');

    let title = '';
    let description = '';
    if (view === 'announcements') {
      title = t('Homepage Announcement / News');
      description = t('Manage the homepage banner shown to all players.');
    } else if (view === 'leaderboards') {
      title = t('Global Leaderboards');
      description = t('View the best verified scores and reset the world leaderboards.');
    } else if (view === 'users') {
      title = t('User Management');
      description = t('Search players by display name or email to clear their statistics or delete their account.');
    } else if (isShopCategory) {
      title = selectedShopCategory.title;
      description = selectedShopCategory.description;
    }

    return (
      <>
        <button
          type="button"
          className="btn-secondary"
          onClick={backAction}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.5rem 0.9rem',
            fontSize: '0.82rem',
            marginBottom: '1.25rem'
          }}
        >
          <ArrowLeft size={15} /> {backLabel}
        </button>

        <div style={{ marginBottom: '1.75rem' }}>
          <h1 style={{ ...pageTitleStyle, fontSize: '1.9rem' }}>{title}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '700px' }}>{description}</p>
        </div>

        {view === 'announcements' && <AdminAnnouncementsSection />}
        {view === 'leaderboards' && <AdminLeaderboardsSection />}
        {view === 'users' && <AdminUsersSection />}
        {isShopCategory && <AdminShopSection key={shopKind} kind={shopKind} />}
      </>
    );
  };

  return (
    <div style={{ width: '100%', maxWidth: '960px', margin: '0 auto', padding: '1rem' }}>
      {view === 'menu' && renderMenu()}
      {view === 'shop' && renderShopMenu()}
      {view !== 'menu' && view !== 'shop' && renderSubpage()}
    </div>
  );
};
