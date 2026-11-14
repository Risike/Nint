const API_BASE = import.meta.env.VITE_API_URL || '/api';

export class ApiClient {
  private static token: string | null = null;

  public static setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('nint_jwt_token', token);
    } else {
      localStorage.removeItem('nint_jwt_token');
    }
  }

  public static getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('nint_jwt_token');
    }
    return this.token;
  }

  public static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network request failed' }));
      throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }

    return response.json();
  }

  // Auth
  public static getCaptchaConfig() {
    return this.request<{ siteKey: string; enabled: boolean }>('/auth/captcha');
  }

  public static register(payload: {
    email: string;
    password: string;
    username: string;
    captchaToken: string;
  }) {
    return this.request<{ requiresVerification: boolean; email: string; message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public static verifyEmail(email: string, code: string) {
    return this.request<{ user: any; token: string }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, code })
    });
  }

  public static resendVerification(email: string) {
    return this.request<{ message: string }>('/auth/verify-email/resend', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  public static login(payload: { identifier: string; password: string }) {
    return this.request<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public static logout() {
    return this.request<{ success: boolean }>('/auth/logout', { method: 'POST' });
  }

  public static getMe() {
    return this.request<any>('/auth/me');
  }

  public static updateMe(payload: { displayName?: string; username?: string; avatarUrl?: string; newPassword?: string; currentPassword?: string }) {
    return this.request<any>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  }

  public static deleteMe(password: string) {
    return this.request<any>('/auth/me', {
      method: 'DELETE',
      body: JSON.stringify({ password })
    });
  }

  public static requestPasswordReset(email: string) {
    return this.request<any>('/auth/password-reset', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  public static confirmPasswordReset(token: string, newPassword: string) {
    return this.request<any>('/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword })
    });
  }

  // Results & Leaderboards
  public static submitResult(data: any) {
    return this.request<any>('/results', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public static getLeaderboard(mode: string, timeframe: string = 'all') {
    return this.request<any>(`/leaderboards/${mode}?timeframe=${timeframe}`);
  }

  public static getMyStats() {
    return this.request<any>('/stats/me');
  }

  public static getPlayerStats(userId: string) {
    return this.request<any>(`/stats/${encodeURIComponent(userId)}`);
  }

  // Shop
  public static getShop() {
    return this.request<any>('/shop');
  }

  public static getThemes() {
    return this.request<any[]>('/shop/themes');
  }

  public static getDecorations() {
    return this.request<any[]>('/shop/decorations');
  }

  public static purchaseShopItem(itemId: string) {
    return this.request<any>('/shop/purchase', {
      method: 'POST',
      body: JSON.stringify({ itemId })
    });
  }

  public static equipShopItem(itemId: string) {
    return this.request<any>('/shop/equip', {
      method: 'POST',
      body: JSON.stringify({ itemId })
    });
  }

  // Settings
  public static getSettings() {
    return this.request<any>('/settings');
  }

  public static updateSettings(settings: any) {
    return this.request<any>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  }

  // Matches
  public static createOnlineMatch(ranked: boolean, mode: 'versus' | 'coop_boss' | 'blast' = 'versus') {
    return this.request<{ matchId: string; seed: number; ranked: boolean; mode: string; status: string }>('/matches/online', {
      method: 'POST',
      body: JSON.stringify({ ranked, mode })
    });
  }

  public static getOnlineMatch(matchId: string) {
    return this.request<{
      matchId: string;
      seed: number;
      ranked: boolean;
      mode: string;
      status: string;
      winnerUserId: string | null;
      players: {
        host: { userId: string; rating: number };
        guest: { userId: string; rating: number } | null;
      };
    }>(`/matches/online/${encodeURIComponent(matchId)}`);
  }

  public static getOnlineMatchResult(matchId: string) {
    return this.request<{
      matchId: string;
      ranked: boolean;
      status: string;
      settled: boolean;
      result: 'win' | 'loss' | 'draw' | null;
      elo: { oldRating: number; newRating: number; delta: number; opponentRating: number | null } | null;
    }>(`/matches/online/${encodeURIComponent(matchId)}/result`);
  }

  public static joinOnlineMatch(matchId: string) {
    return this.request<{ matchId: string; seed: number; ranked: boolean; mode: string; status: string }>(
      `/matches/online/${encodeURIComponent(matchId)}/join`,
      { method: 'POST', body: JSON.stringify({}) }
    );
  }

  public static cancelOnlineMatch(matchId: string) {
    return this.request<{ success: boolean }>('/matches/forfeit', {
      method: 'POST',
      body: JSON.stringify({ matchId, result: 'cancel' })
    });
  }

  public static createOnlineRematch(matchId: string) {
    return this.request<{ matchId: string; seed: number; ranked: boolean; mode: string; status: string }>(
      `/matches/online/${encodeURIComponent(matchId)}/rematch`,
      { method: 'POST', body: JSON.stringify({}) }
    );
  }

  public static awardCoopCredits(
    matchId: string,
    data: { roundKey: string; lines: number; piecesPlaced: number; duration: number }
  ) {
    return this.request<{ success: boolean; creditsAwarded: number; credits: number; duplicate: boolean }>(
      `/matches/online/${encodeURIComponent(matchId)}/coop-credits`,
      { method: 'POST', body: JSON.stringify(data) }
    );
  }

  public static recordMatch(data: any) {
    return this.request<any>('/matches/record', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public static sendBeaconForfeit(data: any) {
    const token = this.getToken();
    if (!token) return;
    const url = `${API_BASE}/matches/forfeit`;
    const body = JSON.stringify(data);

    // sendBeacon is the most reliable transport during pagehide/browser close,
    // but it cannot attach an Authorization header. The forfeit route accepts
    // the JWT from the body as a narrow, route-specific fallback.
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([JSON.stringify({ ...data, token })], { type: 'application/json' });
        if (navigator.sendBeacon(url, blob)) return;
      }
    } catch (e) {
      console.warn('sendBeaconForfeit beacon failed:', e);
    }

    try {
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body,
        keepalive: true
      }).catch(() => {});
    } catch (e) {
      console.warn('sendBeaconForfeit failed:', e);
    }
  }

  // Admin
  public static getNews() {
    return this.request<{ message: string; updatedAt: number | null }>('/admin/news');
  }

  public static setNews(message: string) {
    return this.request<{ success: boolean }>('/admin/news', {
      method: 'PUT',
      body: JSON.stringify({ message })
    });
  }

  public static clearLeaderboards() {
    return this.request<{ success: boolean }>('/admin/leaderboards', {
      method: 'DELETE'
    });
  }

  public static adminSearchUsers(q: string) {
    return this.request<any[]>(`/admin/users?q=${encodeURIComponent(q)}`);
  }

  public static adminClearUserStats(userId: string) {
    return this.request<{ success: boolean }>(`/admin/users/${userId}/stats`, {
      method: 'DELETE'
    });
  }

  public static adminDeleteUser(userId: string) {
    return this.request<{ success: boolean }>(`/admin/users/${userId}`, {
      method: 'DELETE'
    });
  }

  public static adminGetShopItems() {
    return this.request<any[]>('/admin/shop');
  }

  public static adminGetFirebaseMatches() {
    return this.request<{
      total: number;
      matches: { matchId: string; mode: string; ranked: boolean; serverStatus: string; createdAt: number }[];
    }>('/admin/firebase/matches');
  }

  public static adminCreateShopItem(data: any) {
    return this.request<any>('/admin/shop', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public static adminUpdateShopItem(itemId: string, data: any) {
    return this.request<any>(`/admin/shop/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  public static adminDeleteShopItem(itemId: string) {
    return this.request<{ success: boolean }>(`/admin/shop/${itemId}`, {
      method: 'DELETE'
    });
  }
}
