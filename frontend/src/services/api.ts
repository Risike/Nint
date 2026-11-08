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
  public static register(payload: { email: string; password: string; displayName: string }) {
    return this.request<{ user: any; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public static login(payload: { email: string; password: string }) {
    return this.request<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public static getMe() {
    return this.request<any>('/auth/me');
  }

  public static updateMe(payload: { displayName?: string; avatarUrl?: string; newPassword?: string; currentPassword?: string }) {
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
  public static recordMatch(data: any) {
    return this.request<any>('/matches/record', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  public static sendBeaconRecordMatch(data: any) {
    const token = this.getToken();
    if (!token) return;
    const url = `${API_BASE}/matches/record`;
    const payload = JSON.stringify(data);

    try {
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: payload,
        keepalive: true
      }).catch(() => {});
    } catch (e) {
      console.warn('sendBeaconRecordMatch failed:', e);
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
}
