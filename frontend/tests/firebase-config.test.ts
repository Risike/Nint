import { describe, expect, it } from 'vitest';
import { resolveFirebaseConfig, type RuntimeFirebaseConfig } from '../src/services/firebaseRealtime';

describe('resolveFirebaseConfig', () => {
  it('lets the runtime config override the build-time values', () => {
    const config = resolveFirebaseConfig({
      apiKey: 'AIza-runtime-key',
      authDomain: 'prod.firebaseapp.com',
      databaseURL: 'https://prod-default-rtdb.europe-west1.firebasedatabase.app',
      projectId: 'prod-project',
      storageBucket: 'prod-project.appspot.com',
      messagingSenderId: '424242',
      appId: '1:424242:web:abcdef',
      useEmulator: 'false'
    });

    expect(config).toMatchObject({
      apiKey: 'AIza-runtime-key',
      authDomain: 'prod.firebaseapp.com',
      databaseURL: 'https://prod-default-rtdb.europe-west1.firebasedatabase.app',
      projectId: 'prod-project',
      storageBucket: 'prod-project.appspot.com',
      messagingSenderId: '424242',
      appId: '1:424242:web:abcdef',
      useEmulator: 'false'
    });
  });

  it('falls back to the build-time values when the container provides none', () => {
    const config = resolveFirebaseConfig({ apiKey: '  ', databaseURL: '' });

    expect(config.apiKey).toBe('demo-api-key');
    expect(config.databaseURL).toBe('https://nint-demo-default-rtdb.firebaseio.com');
    expect(config.useEmulator).toBe('false');
  });

  it('keeps an emulator opt-in from the runtime environment', () => {
    expect(resolveFirebaseConfig({ useEmulator: 'true' }).useEmulator).toBe('true');
  });

  it('reads the config that the web container writes into config.js', () => {
    const scope = globalThis as { __NINT_CONFIG__?: RuntimeFirebaseConfig };
    const previous = scope.__NINT_CONFIG__;
    scope.__NINT_CONFIG__ = { apiKey: 'AIza-from-config-js', projectId: 'from-config-js' };

    try {
      expect(resolveFirebaseConfig()).toMatchObject({
        apiKey: 'AIza-from-config-js',
        projectId: 'from-config-js'
      });
    } finally {
      scope.__NINT_CONFIG__ = previous;
    }
  });
});
