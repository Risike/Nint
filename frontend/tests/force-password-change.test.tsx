// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForcePasswordChangePage } from '../src/pages/ForcePasswordChangePage';

const auth = vi.hoisted(() => ({
  changePassword: vi.fn(),
  logout: vi.fn()
}));

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'admin@nint.local' },
    changePassword: auth.changePassword,
    logout: auth.logout
  })
}));

vi.mock('../src/i18n/useI18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}));

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('Forced password change', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    auth.changePassword.mockResolvedValue(undefined);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    root = null;
    container?.remove();
    container = null;
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  async function setInputValue(input: HTMLInputElement, value: string) {
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await flush();
    });
  }

  it('blocks the app, validates confirmation and changes the password', async () => {
    const onNavigate = vi.fn();
    await act(async () => {
      root!.render(<ForcePasswordChangePage onNavigate={onNavigate} />);
      await flush();
    });

    expect(container!.textContent).toContain('Change your password');
    expect(container!.textContent).toContain('admin@nint.local');

    const inputs = Array.from(container!.querySelectorAll<HTMLInputElement>('input[type="password"]'));
    expect(inputs).toHaveLength(3);
    await setInputValue(inputs[0], 'admin');
    await setInputValue(inputs[1], 'N3w!Passw0rd');
    await setInputValue(inputs[2], 'different');

    const form = container!.querySelector('form')!;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flush();
    });

    expect(auth.changePassword).not.toHaveBeenCalled();
    expect(container!.textContent).toContain('Passwords do not match.');

    await setInputValue(inputs[2], 'N3w!Passw0rd');
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await flush();
    });

    expect(auth.changePassword).toHaveBeenCalledWith('admin', 'N3w!Passw0rd');
  });
});
