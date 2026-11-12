// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserName } from '../src/components/user/UserName';

vi.mock('../src/i18n/useI18n', () => ({
  useI18n: () => ({ language: 'en' })
}));

describe('UserName title slot', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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

  it('keeps the title line height when no title is equipped', async () => {
    await act(async () => {
      root!.render(
        <UserName
          displayName="Tester"
          cosmetics={{ name_color: '#f8fafc', name_decoration: 'none', title: '' }}
        />
      );
    });

    const placeholder = Array.from(container!.querySelectorAll('span'))
      .find((span) => span.textContent === '\u00A0');

    expect(placeholder).toBeTruthy();
    expect(placeholder?.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders the selected profile icon and defaults to the player icon', async () => {
    await act(async () => {
      root!.render(
        <UserName
          displayName="Tester"
          cosmetics={{ profile_icon: 'rocket' }}
          iconSize="1.6rem"
        />
      );
    });

    const rocket = container!.querySelector('[data-profile-icon="rocket"]');
    expect(rocket?.textContent).toBe('🚀');
    expect((rocket as HTMLElement).style.fontSize).toBe('1.6rem');
    expect((container!.firstElementChild as HTMLElement).style.alignItems).toBe('center');

    await act(async () => {
      root!.render(<UserName displayName="Tester" />);
    });

    const fallback = container!.querySelector('[data-profile-icon="user"]');
    expect(fallback?.textContent).toBe('👤');
  });

  it('renders a server-provided decoration and strips unsafe HTML', async () => {
    await act(async () => {
      root!.render(
        <UserName
          displayName="Tester"
          cosmetics={{ name_color: '#ff0000', name_decoration: 'custom_spark' }}
          decorationHtml={'<span>{name}<script>alert(1)</script></span>'}
          showIcon={false}
        />
      );
    });

    expect(container!.textContent).toContain('Tester');
    expect(container!.querySelector('script')).toBeNull();
    expect(container!.querySelector('[data-profile-icon]')).toBeNull();
  });

  it('renders a gradient name color with clipped text', async () => {
    await act(async () => {
      root!.render(
        <UserName
          displayName="Tester"
          cosmetics={{ name_color: 'gradient:90:#ff0040,#00b0ff' }}
        />
      );
    });

    const gradientName = Array.from(container!.querySelectorAll('span'))
      .find((span) => span.style.backgroundImage.includes('linear-gradient'));

    expect(gradientName?.style.backgroundImage).toContain('90deg');
    expect(gradientName?.style.getPropertyValue('-webkit-text-fill-color')).toBe('transparent');
  });
});
