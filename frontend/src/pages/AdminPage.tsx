import React, { useState, useEffect } from 'react';
import { Shield, Newspaper, Trash2, Search, UserX, BarChart3, AlertTriangle, CheckCircle, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiClient } from '../services/api';

interface AdminPageProps {
  onNavigate?: (tab: string) => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();

  // Guard: redirect if not admin
  useEffect(() => {
    if (user && !user.is_admin) {
      onNavigate?.('home');
    }
  }, [user, onNavigate]);

  // --- News Message ---
  const [newsMessage, setNewsMessage] = useState('');
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsSaved, setNewsSaved] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);

  useEffect(() => {
    ApiClient.getNews()
      .then(data => setNewsMessage(data.message || ''))
      .catch(() => {});
  }, []);

  const handleSaveNews = async () => {
    setNewsLoading(true);
    setNewsSaved(false);
    setNewsError(null);
    try {
      await ApiClient.setNews(newsMessage);
      setNewsSaved(true);
      setTimeout(() => setNewsSaved(false), 3000);
    } catch (e: any) {
      setNewsError(e?.message || 'Erreur lors de la sauvegarde du message.');
    }
    setNewsLoading(false);
  };

  // --- Leaderboards ---
  const [leaderboardClearing, setLeaderboardClearing] = useState(false);
  const [leaderboardCleared, setLeaderboardCleared] = useState(false);
  const [showLeaderboardConfirm, setShowLeaderboardConfirm] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  const handleClearLeaderboards = async () => {
    setLeaderboardClearing(true);
    setLeaderboardError(null);
    try {
      await ApiClient.clearLeaderboards();
      setLeaderboardCleared(true);
      setShowLeaderboardConfirm(false);
      setTimeout(() => setLeaderboardCleared(false), 3000);
    } catch (e: any) {
      setLeaderboardError(e?.message || 'Erreur lors de la réinitialisation des leaderboards.');
    }
    setLeaderboardClearing(false);
  };

  // --- User Search & Management ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'clear_stats' | 'delete'; userId: string; email: string; displayName: string } | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchLoading(true);
    setActionError(null);
    try {
      const results = await ApiClient.adminSearchUsers(searchQuery);
      setSearchResults(results);
    } catch (e: any) {
      setActionError(e?.message || 'Erreur lors de la recherche.');
    }
    setSearchLoading(false);
  };

  useEffect(() => {
    // Initial load with empty query to display recent users
    if (user?.is_admin) {
      handleSearch();
    }
  }, [user]);

  const handleClearUserStats = async (userId: string) => {
    setActionError(null);
    try {
      await ApiClient.adminClearUserStats(userId);
      setActionSuccess('Statistiques du joueur réinitialisées avec succès.');
      setTimeout(() => setActionSuccess(null), 3000);
      setConfirmAction(null);
      handleSearch();
    } catch (e: any) {
      setActionError(e?.message || 'Erreur lors de la réinitialisation des stats.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setActionError(null);
    try {
      await ApiClient.adminDeleteUser(userId);
      setActionSuccess('Compte supprimé avec succès.');
      setTimeout(() => setActionSuccess(null), 3000);
      setConfirmAction(null);
      setSearchResults(prev => prev.filter(u => u.id !== userId));
    } catch (e: any) {
      setActionError(e?.message || 'Erreur lors de la suppression du compte.');
    }
  };

  if (!user?.is_admin) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <Shield size={48} style={{ color: 'var(--accent-red)', marginBottom: '1rem' }} />
        <h2 style={{ color: 'var(--text-primary)' }}>Accès Refusé</h2>
        <p style={{ color: 'var(--text-muted)' }}>Vous devez être administrateur pour accéder à cette page.</p>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: '900px', margin: '0 auto', padding: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
        <div style={{
          background: 'rgba(6, 182, 212, 0.15)',
          color: 'var(--accent-cyan)',
          padding: '0.6rem',
          borderRadius: 'var(--radius-sm)'
        }}>
          <Shield size={26} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Panneau d'Administration
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Gestion de la plateforme Nint, des utilisateurs et des leaderboards
          </p>
        </div>
      </div>

      {actionSuccess && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.75rem 1rem', marginBottom: '1rem',
          background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: 'var(--radius-sm)', color: 'var(--accent-green)', fontSize: '0.9rem'
        }}>
          <CheckCircle size={16} /> {actionSuccess}
        </div>
      )}

      {actionError && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.75rem 1rem', marginBottom: '1rem',
          background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-sm)', color: 'var(--accent-red)', fontSize: '0.9rem'
        }}>
          <AlertTriangle size={16} /> {actionError}
        </div>
      )}

      {/* 1. News Message Section */}
      <div className="panel-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
          <Newspaper size={20} style={{ color: 'var(--accent-cyan)' }} />
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Message d'actualité (Home Page)
          </h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Ce message apparaît dans un bandeau en haut de la page d'accueil pour tous les joueurs. Laissez vide pour masquer le bandeau.
        </p>
        <textarea
          value={newsMessage}
          onChange={(e) => setNewsMessage(e.target.value)}
          placeholder="Entrez le message à afficher sur la page d'accueil (ex: Tournoi ce samedi à 20h !)..."
          rows={3}
          style={{
            width: '100%', padding: '0.75rem',
            background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
            fontSize: '0.9rem', resize: 'vertical', fontFamily: 'inherit',
            boxSizing: 'border-box'
          }}
        />
        {newsError && (
          <p style={{ color: 'var(--accent-red)', fontSize: '0.8rem', marginTop: '0.4rem' }}>{newsError}</p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
          <button
            className="btn-primary"
            onClick={handleSaveNews}
            disabled={newsLoading}
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
          >
            {newsLoading ? 'Enregistrement...' : 'Enregistrer le message'}
          </button>
          {newsSaved && (
            <span style={{ color: 'var(--accent-green)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <CheckCircle size={14} /> Enregistré avec succès !
            </span>
          )}
        </div>
      </div>

      {/* 2. Clear Leaderboards Section */}
      <div className="panel-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
          <BarChart3 size={20} style={{ color: 'var(--accent-cyan)' }} />
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Leaderboards globaux
          </h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Efface tous les scores enregistrés et records personnels (Marathon, Sprint, Ultra) de tous les utilisateurs. Cette action est irréversible.
        </p>

        {leaderboardError && (
          <p style={{ color: 'var(--accent-red)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>{leaderboardError}</p>
        )}

        {!showLeaderboardConfirm ? (
          <button
            onClick={() => setShowLeaderboardConfirm(true)}
            style={{
              padding: '0.5rem 1.25rem', fontSize: '0.85rem',
              background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-red)',
              border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)',
              cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.4rem'
            }}
          >
            <Trash2 size={14} /> Vider tous les leaderboards
          </button>
        ) : (
          <div style={{
            padding: '1rem', background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 'var(--radius-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', color: 'var(--accent-red)', fontWeight: 600, fontSize: '0.9rem' }}>
              <AlertTriangle size={16} /> Confirmer la suppression complète des leaderboards ?
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Tous les résultats de jeux et records personnels de tous les joueurs seront définitivement supprimés.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleClearLeaderboards}
                disabled={leaderboardClearing}
                style={{
                  padding: '0.45rem 1rem', fontSize: '0.85rem',
                  background: 'var(--accent-red)', color: '#fff',
                  border: 'none', borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer', fontWeight: 600
                }}
              >
                {leaderboardClearing ? 'Nettoyage en cours...' : 'Oui, tout vider'}
              </button>
              <button
                onClick={() => setShowLeaderboardConfirm(false)}
                style={{
                  padding: '0.45rem 1rem', fontSize: '0.85rem',
                  background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer'
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {leaderboardCleared && (
          <div style={{ color: 'var(--accent-green)', fontSize: '0.85rem', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <CheckCircle size={14} /> Les leaderboards ont été réinitialisés avec succès !
          </div>
        )}
      </div>

      {/* 3. User Search & Management Section */}
      <div className="panel-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
          <Search size={20} style={{ color: 'var(--accent-cyan)' }} />
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Gestion des Utilisateurs
          </h2>
        </div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Recherchez un utilisateur par nom ou email pour réinitialiser ses statistiques ou supprimer son compte.
        </p>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrer par nom ou adresse email..."
            style={{
              flex: 1, padding: '0.6rem 0.85rem',
              background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
              fontSize: '0.9rem'
            }}
          />
          <button
            type="submit"
            className="btn-primary"
            disabled={searchLoading}
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Search size={14} />
            {searchLoading ? 'Recherche...' : 'Rechercher'}
          </button>
        </form>

        {/* Confirmation Modal / Banner */}
        {confirmAction && (
          <div style={{
            padding: '1.1rem', marginBottom: '1.25rem',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem', color: 'var(--accent-red)', fontWeight: 700, fontSize: '0.95rem' }}>
              <AlertTriangle size={18} />
              {confirmAction.type === 'clear_stats'
                ? `Vider les statistiques de ${confirmAction.displayName} (${confirmAction.email}) ?`
                : `Supprimer définitivement le compte de ${confirmAction.displayName} (${confirmAction.email}) ?`}
            </div>
            <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
              {confirmAction.type === 'clear_stats'
                ? 'Cette action remettra le ratio W/L, le rating ELO à 1000, et effacera tout son historique de matchs et de scores. Le compte reste actif.'
                : 'Attention : Cette action supprimera le compte, les paramètres, scores et tout l’historique associé. Cette action est irréversible.'}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => confirmAction.type === 'clear_stats'
                  ? handleClearUserStats(confirmAction.userId)
                  : handleDeleteUser(confirmAction.userId)}
                style={{
                  padding: '0.45rem 1.1rem', fontSize: '0.85rem',
                  background: 'var(--accent-red)', color: '#fff',
                  border: 'none', borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer', fontWeight: 600
                }}
              >
                {confirmAction.type === 'clear_stats' ? 'Confirmer : Vider les stats' : 'Confirmer : Supprimer le compte'}
              </button>
              <button
                onClick={() => setConfirmAction(null)}
                style={{
                  padding: '0.45rem 1.1rem', fontSize: '0.85rem',
                  background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer'
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* User list */}
        {searchResults.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Aucun utilisateur trouvé.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {searchResults.map(u => (
              <div
                key={u.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.85rem 1rem',
                  background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)', gap: '1rem', flexWrap: 'wrap'
                }}
              >
                <div style={{ minWidth: '220px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.92rem' }}>
                      {u.display_name}
                    </span>
                    {u.is_admin === 1 && (
                      <span style={{
                        fontSize: '0.65rem', padding: '0.15rem 0.45rem',
                        background: 'rgba(6, 182, 212, 0.2)', color: 'var(--accent-cyan)',
                        borderRadius: '999px', fontWeight: 700
                      }}>ADMIN</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {u.email}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>ELO: </span>
                    <strong style={{ color: 'var(--accent-cyan)' }}>{u.rating}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Matchs: </span>
                    <strong>{u.games_played}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>W/L: </span>
                    <span style={{ color: 'var(--accent-green)' }}>{u.wins}</span> / <span style={{ color: 'var(--accent-red)' }}>{u.losses}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', marginLeft: 'auto' }}>
                  <button
                    onClick={() => setConfirmAction({ type: 'clear_stats', userId: u.id, email: u.email, displayName: u.display_name })}
                    title="Vider les statistiques de cet utilisateur"
                    style={{
                      padding: '0.4rem 0.75rem', fontSize: '0.78rem',
                      background: 'rgba(234, 179, 8, 0.15)', color: '#eab308',
                      border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600
                    }}
                  >
                    <RotateCcw size={12} /> Vider stats
                  </button>
                  {u.is_admin !== 1 && (
                    <button
                      onClick={() => setConfirmAction({ type: 'delete', userId: u.id, email: u.email, displayName: u.display_name })}
                      title="Supprimer définitivement ce compte"
                      style={{
                        padding: '0.4rem 0.75rem', fontSize: '0.78rem',
                        background: 'rgba(239, 68, 68, 0.15)', color: 'var(--accent-red)',
                        border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600
                      }}
                    >
                      <UserX size={12} /> Supprimer
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
