export class LocalStorageManager {
  private static PREFIX = 'nint_';

  public static getItem<T>(key: string, defaultValue: T): T {
    try {
      const val = localStorage.getItem(this.PREFIX + key);
      return val ? JSON.parse(val) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  public static setItem<T>(key: string, value: T): void {
    try {
      localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.warn('LocalStorage write failed:', e);
    }
  }

  public static removeItem(key: string): void {
    try {
      localStorage.removeItem(this.PREFIX + key);
    } catch {}
  }
}
