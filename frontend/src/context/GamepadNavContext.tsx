import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { soundManager } from '../game/audio/soundManager';
import { MAIN_TABS, getMainTab } from '../navigation';

const RIGHT_STICK_SCROLL_DEADZONE = 0.18;
const RIGHT_STICK_SCROLL_SPEED = 1100; // pixels per second at full deflection

// The right stick scrolls vertically on every page, including gameplay pages.
// Do not tie this to the menu action branch: it must keep working while the
// gameplay input is yielded to the game engine.
export const scrollPageWithRightStick = (gamepad: Gamepad, deltaMs: number): boolean => {
  if (typeof window === 'undefined' || typeof window.scrollBy !== 'function') return false;

  const axisY = gamepad.axes[3] ?? 0;
  const magnitude = Math.abs(axisY);
  if (magnitude <= RIGHT_STICK_SCROLL_DEADZONE) return false;

  const intensity = Math.min(
    1,
    (magnitude - RIGHT_STICK_SCROLL_DEADZONE) / (1 - RIGHT_STICK_SCROLL_DEADZONE)
  );
  const frameDelta = Math.min(deltaMs, 50);
  const delta = Math.sign(axisY) * intensity * RIGHT_STICK_SCROLL_SPEED * (frameDelta / 1000);
  if (Math.abs(delta) < 0.1) return false;

  window.scrollBy({ top: delta, behavior: 'auto' });
  return true;
};

// Helper to smoothly and accurately scroll an element into the visible viewport,
// taking into account sticky navbar (~75px) and fixed bottom gamepad bar (~80px)
export const scrollElementIntoViewSmart = (el: HTMLElement | null) => {
  if (!el || typeof window === 'undefined') return;

  // 1. Check if element is inside an inner scroll container (e.g. modal)
  let parent = el.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY;
    if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) {
      const containerRect = parent.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const topMargin = 20;
      const bottomMargin = 20;

      if (elRect.top < containerRect.top + topMargin) {
        parent.scrollTop -= (containerRect.top + topMargin - elRect.top);
      } else if (elRect.bottom > containerRect.bottom - bottomMargin) {
        parent.scrollTop += (elRect.bottom - (containerRect.bottom - bottomMargin));
      }
      return;
    }
    parent = parent.parentElement;
  }

  // 2. Main window scroll (handles sticky navbar and fixed gamepad helper bar)
  const rect = el.getBoundingClientRect();
  const navbarHeight = 85; // sticky navbar + margin
  const bottomBarHeight = 90; // fixed gamepad helper bar + bottom edge margin
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  if (rect.top < navbarHeight) {
    // Hidden underneath navbar at the top: scroll up to reveal
    const delta = rect.top - navbarHeight;
    window.scrollBy({ top: delta, behavior: 'smooth' });
  } else if (rect.bottom > viewportHeight - bottomBarHeight) {
    // Hidden underneath bottom edge or gamepad bar at the bottom: scroll down to reveal
    const delta = rect.bottom - (viewportHeight - bottomBarHeight);
    window.scrollBy({ top: delta, behavior: 'smooth' });
  }
};

interface BackHandlerRecord {
  id: string;
  handler: () => boolean | void;
}

interface GamepadNavContextValue {
  gamepadConnected: boolean;
  gamepadName: string | null;
  isGameplayActive: boolean;
  setGameplayActive: (active: boolean) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  focusedElement: HTMLElement | null;
  setFocusedElement: (el: HTMLElement | null) => void;
  registerBackHandler: (id: string, handler: () => boolean | void) => void;
  unregisterBackHandler: (id: string) => void;
  triggerBack: () => void;
}

const GamepadNavContext = createContext<GamepadNavContextValue | null>(null);

export const useGamepadNav = () => {
  const ctx = useContext(GamepadNavContext);
  if (!ctx) {
    throw new Error('useGamepadNav must be used within GamepadNavProvider');
  }
  return ctx;
};

// Convenience hook to pause UI navigation during active gameplay
export const useGamepadActive = (active: boolean) => {
  const { setGameplayActive } = useGamepadNav();
  useEffect(() => {
    setGameplayActive(active);
    return () => {
      setGameplayActive(false);
    };
  }, [active, setGameplayActive]);
};

// Convenience hook to register a back action (B button)
export const useGamepadBack = (handler: () => boolean | void, deps: any[] = []) => {
  const { registerBackHandler, unregisterBackHandler } = useGamepadNav();
  const idRef = useRef(`back_${Math.random().toString(36).substring(2, 9)}`);

  useEffect(() => {
    const id = idRef.current;
    registerBackHandler(id, handler);
    return () => {
      unregisterBackHandler(id);
    };
  }, deps);
};

interface GamepadNavProviderProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isAuthenticated: boolean;
  onMenuMute?: () => void;
  onMenuFullscreen?: () => void;
}

export const GamepadNavProvider: React.FC<GamepadNavProviderProps> = ({
  children,
  activeTab,
  setActiveTab,
  isAuthenticated,
  onMenuMute,
  onMenuFullscreen
}) => {
  const [gamepadConnected, setGamepadConnected] = useState<boolean>(false);
  const [gamepadName, setGamepadName] = useState<string | null>(null);
  const [isGameplayActive, setIsGameplayActive] = useState<boolean>(false);
  const [focusedElement, setFocusedElementState] = useState<HTMLElement | null>(null);

  const isGameplayActiveRef = useRef(isGameplayActive);
  isGameplayActiveRef.current = isGameplayActive;

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const isAuthenticatedRef = useRef(isAuthenticated);
  isAuthenticatedRef.current = isAuthenticated;

  const focusedElementRef = useRef<HTMLElement | null>(null);
  const backHandlersRef = useRef<BackHandlerRecord[]>([]);
  const menuActionsRef = useRef({ onMenuMute, onMenuFullscreen });
  menuActionsRef.current = { onMenuMute, onMenuFullscreen };

  const registerBackHandler = useCallback((id: string, handler: () => boolean | void) => {
    backHandlersRef.current = backHandlersRef.current.filter(b => b.id !== id);
    backHandlersRef.current.push({ id, handler });
  }, []);

  const unregisterBackHandler = useCallback((id: string) => {
    backHandlersRef.current = backHandlersRef.current.filter(b => b.id !== id);
  }, []);

  // Safely update focused element and update DOM attributes/classes
  const setFocusedElement = useCallback((el: HTMLElement | null) => {
    if (focusedElementRef.current && focusedElementRef.current !== el) {
      focusedElementRef.current.removeAttribute('data-gamepad-focused');
      focusedElementRef.current.classList.remove('gamepad-focused');
    }

    focusedElementRef.current = el;
    setFocusedElementState(el);

    if (el) {
      el.setAttribute('data-gamepad-focused', 'true');
      el.classList.add('gamepad-focused');
      // Ensure smooth visibility with proper clearance for sticky navbar & bottom helper bar
      scrollElementIntoViewSmart(el);
    }
  }, []);

  // B button action
  const triggerBack = useCallback(() => {
    const handlers = backHandlersRef.current;
    if (handlers.length > 0) {
      const top = handlers[handlers.length - 1];
      const handled = top.handler();
      if (handled !== false) {
        soundManager.playMove();
        return;
      }
    }

    // Default fallback: return to 'home' if not already there
    if (activeTabRef.current !== 'home') {
      soundManager.playMove();
      setActiveTab('home');
      setFocusedElement(null);
    }
  }, [setActiveTab, setFocusedElement]);

  // Tab switching via bumpers
  const navigateTab = useCallback((direction: number) => {
    const authTab = isAuthenticatedRef.current ? 'profile' : 'login';
    const allTabs = [...MAIN_TABS, authTab];
    const currentIndex = allTabs.indexOf(getMainTab(activeTabRef.current));
    const validIndex = currentIndex >= 0 ? currentIndex : 0;
    let nextIndex = validIndex + direction;

    if (nextIndex < 0) nextIndex = allTabs.length - 1;
    if (nextIndex >= allTabs.length) nextIndex = 0;

    const nextTab = allTabs[nextIndex];
    soundManager.playRotate();
    setActiveTab(nextTab);
    setFocusedElement(null);
  }, [setActiveTab, setFocusedElement]);

  // Focusable elements discovery in current context
  const getFocusableElements = useCallback((): HTMLElement[] => {
    // If a modal or backdrop is visible, restrict navigation to it!
    const modal = document.querySelector('.modal-card, .overlay-backdrop:not([style*="display: none"])');
    const container = modal || document.querySelector('main.main-content') || document.body;

    const selectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[role="button"]:not([disabled])',
      '.panel-card',
      '.btn-primary',
      '.btn-secondary'
    ];

    const elements = Array.from(container.querySelectorAll<HTMLElement>(selectors.join(', ')));

    return elements.filter((el) => {
      // Must be visible
      if (el.offsetWidth === 0 || el.offsetHeight === 0) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;

      // Filter out non-interactive panel cards
      if (el.classList.contains('panel-card')) {
        const isClickable = el.onclick !== null ||
          el.getAttribute('role') === 'button' ||
          el.getAttribute('tabindex') !== null ||
          style.cursor === 'pointer' ||
          el.hasAttribute('data-selectable');
        if (!isClickable) return false;
      }

      return true;
    });
  }, []);

  // Spatial 2D navigation
  const moveFocus = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    const candidates = getFocusableElements();
    if (candidates.length === 0) return;

    let current = focusedElementRef.current;
    if (!current || !document.body.contains(current) || !candidates.includes(current)) {
      // No current focus: pick the top-left-most candidate
      let best = candidates[0];
      let bestScore = Infinity;
      for (const el of candidates) {
        const rect = el.getBoundingClientRect();
        const score = rect.top * 1000 + rect.left;
        if (score < bestScore) {
          bestScore = score;
          best = el;
        }
      }
      setFocusedElement(best);
      soundManager.playMove();
      return;
    }

    // Special handling for sliders when moving left / right
    if (current.tagName === 'INPUT' && (current as HTMLInputElement).type === 'range') {
      const slider = current as HTMLInputElement;
      const min = parseFloat(slider.min || '0');
      const max = parseFloat(slider.max || '100');
      const step = parseFloat(slider.step || '1');
      const curVal = parseFloat(slider.value || '0');

      const setSliderValue = (value: number) => {
        // React tracks the DOM value; assigning `slider.value` first makes the
        // synthetic change invisible to React. Use the native setter so the
        // controlled slider actually updates its state.
        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(slider, String(value));
        } else {
          slider.value = String(value);
        }
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        slider.dispatchEvent(new Event('change', { bubbles: true }));
      };

      if (direction === 'left' && curVal > min) {
        setSliderValue(Math.max(min, curVal - step));
        soundManager.playMove();
        return;
      } else if (direction === 'right' && curVal < max) {
        setSliderValue(Math.min(max, curVal + step));
        soundManager.playMove();
        return;
      }
    }

    const currentRect = current.getBoundingClientRect();
    const cx = currentRect.left + currentRect.width / 2;
    const cy = currentRect.top + currentRect.height / 2;

    let bestCandidate: HTMLElement | null = null;
    let minDistance = Infinity;

    for (const el of candidates) {
      if (el === current) continue;
      const r = el.getBoundingClientRect();
      const ex = r.left + r.width / 2;
      const ey = r.top + r.height / 2;

      const dx = ex - cx;
      const dy = ey - cy;

      let primary = 0;
      let secondary = 0;
      let inDirection = false;

      if (direction === 'right') {
        // Cone filter: element must be more to the right than it is up/down
        if (dx > 5 && dx > Math.abs(dy) * 0.6) {
          inDirection = true;
          primary = dx;
          secondary = Math.abs(dy);
        }
      } else if (direction === 'left') {
        if (dx < -5 && -dx > Math.abs(dy) * 0.6) {
          inDirection = true;
          primary = -dx;
          secondary = Math.abs(dy);
        }
      } else if (direction === 'down') {
        // Cone filter: element must be more below than it is left/right
        if (dy > 5 && dy > Math.abs(dx) * 0.6) {
          inDirection = true;
          primary = dy;
          secondary = Math.abs(dx);
        }
      } else if (direction === 'up') {
        if (dy < -5 && -dy > Math.abs(dx) * 0.6) {
          inDirection = true;
          primary = -dy;
          secondary = Math.abs(dx);
        }
      }

      if (inDirection) {
        // Weighted distance emphasizing primary axis
        const dist = primary + secondary * 1.5;
        if (dist < minDistance) {
          minDistance = dist;
          bestCandidate = el;
        }
      }
    }

    // Fallback: if no element directly in that cone, wrap to next/previous in DOM list
    if (!bestCandidate) {
      const idx = candidates.indexOf(current);
      if (direction === 'down' || direction === 'right') {
        bestCandidate = candidates[(idx + 1) % candidates.length];
      } else if (direction === 'up' || direction === 'left') {
        bestCandidate = candidates[(idx - 1 + candidates.length) % candidates.length];
      }
    }

    if (bestCandidate && bestCandidate !== current) {
      setFocusedElement(bestCandidate);
      soundManager.playMove();
    }
  }, [getFocusableElements, setFocusedElement]);

  // A button action (validate / click)
  const triggerSelect = useCallback(() => {
    let current = focusedElementRef.current;
    if (!current || !document.body.contains(current)) {
      const candidates = getFocusableElements();
      if (candidates.length > 0) {
        setFocusedElement(candidates[0]);
        current = candidates[0];
      }
    }

    if (!current) return;

    soundManager.playRotate();

    // Visual activation flash
    current.classList.add('gamepad-pressed');
    setTimeout(() => {
      current?.classList.remove('gamepad-pressed');
    }, 150);

    if (current.tagName === 'INPUT' && (current as HTMLInputElement).type === 'checkbox') {
      const checkbox = current as HTMLInputElement;
      checkbox.checked = !checkbox.checked;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    if (current.tagName === 'INPUT' || current.tagName === 'TEXTAREA') {
      current.focus();
      return;
    }

    current.click();
  }, [getFocusableElements, setFocusedElement]);

  // Main gamepad polling loop
  useEffect(() => {
    let animId: number;
    let prevButtons: boolean[] = [];

    // Timers for DAS/ARR on D-Pad and sticks
    let dpadTimer = 0;
    let lastDirection: 'up' | 'down' | 'left' | 'right' | null = null;
    let lastTime = performance.now();

    const DAS = 250; // Initial delay in ms
    const ARR = 110; // Repeat interval in ms

    const poll = (time: number) => {
      const delta = time - lastTime;
      lastTime = time;

      if (typeof navigator !== 'undefined' && navigator.getGamepads) {
        const gamepads = navigator.getGamepads();
        const gp = Array.from(gamepads).find(g => g && g.connected);

        if (gp) {
          if (!gamepadConnected) {
            setGamepadConnected(true);
            setGamepadName(gp.id);
          }

          scrollPageWithRightStick(gp, delta);

          // If gameplay is active, yield input completely to the game engine
          if (!isGameplayActiveRef.current) {
            const buttons = gp.buttons.map(b => (typeof b === 'object' ? b.pressed : b === 1.0));
            const axes = gp.axes;

            const justPressed = (index: number) => buttons[index] && !prevButtons[index];

            // Bumpers switch tabs. Triggers are reserved for menu system actions.
            const isPrevTab = justPressed(4);
            const isNextTab = justPressed(5);

            if (isPrevTab) {
              navigateTab(-1);
            } else if (isNextTab) {
              navigateTab(1);
            }

            if (justPressed(6)) {
              soundManager.playMove();
              menuActionsRef.current.onMenuMute?.();
            }

            if (justPressed(7)) {
              soundManager.playMove();
              menuActionsRef.current.onMenuFullscreen?.();
            }

            // A Button (0) - Validate
            if (justPressed(0)) {
              triggerSelect();
            }

            // B Button (1) or Back (8) - Retour
            if (justPressed(1) || justPressed(8)) {
              triggerBack();
            }

            // D-Pad and Left Analog Stick navigation
            const stickX = axes[0] || 0;
            const stickY = axes[1] || 0;

            const upPressed = buttons[12] || stickY < -0.55;
            const downPressed = buttons[13] || stickY > 0.55;
            const leftPressed = buttons[14] || stickX < -0.55;
            const rightPressed = buttons[15] || stickX > 0.55;

            let activeDir: 'up' | 'down' | 'left' | 'right' | null = null;
            if (upPressed) activeDir = 'up';
            else if (downPressed) activeDir = 'down';
            else if (leftPressed) activeDir = 'left';
            else if (rightPressed) activeDir = 'right';

            if (activeDir) {
              if (lastDirection !== activeDir) {
                // Immediate initial press
                lastDirection = activeDir;
                dpadTimer = 0;
                moveFocus(activeDir);
              } else {
                // Continuous hold (DAS + ARR)
                dpadTimer += delta;
                if (dpadTimer >= DAS) {
                  const excess = dpadTimer - DAS;
                  if (excess >= ARR) {
                    dpadTimer = DAS;
                    moveFocus(activeDir);
                  }
                }
              }
            } else {
              lastDirection = null;
              dpadTimer = 0;
            }

            prevButtons = buttons;
          } else {
            // While gameplay is active, keep tracking buttons state so returning to UI
            // does NOT falsely detect already-pressed buttons as "just pressed"
            prevButtons = gp.buttons.map(b => (typeof b === 'object' ? b.pressed : b === 1.0));
            lastDirection = null;
            dpadTimer = 0;
          }
        } else {
          if (gamepadConnected) {
            setGamepadConnected(false);
            setGamepadName(null);
            setFocusedElement(null);
          }
        }
      }

      animId = requestAnimationFrame(poll);
    };

    animId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animId);
  }, [gamepadConnected, navigateTab, triggerSelect, triggerBack, moveFocus, setFocusedElement]);

  // Clean up focus when activeTab changes
  useEffect(() => {
    // Automatically focus the first suitable element after tab renders
    const timer = setTimeout(() => {
      if (!isGameplayActiveRef.current && gamepadConnected) {
        const elements = getFocusableElements();
        if (elements.length > 0) {
          setFocusedElement(elements[0]);
        }
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [activeTab, gamepadConnected, getFocusableElements, setFocusedElement]);

  return (
    <GamepadNavContext.Provider
      value={{
        gamepadConnected,
        gamepadName,
        isGameplayActive,
        setGameplayActive: setIsGameplayActive,
        activeTab,
        setActiveTab,
        focusedElement,
        setFocusedElement,
        registerBackHandler,
        unregisterBackHandler,
        triggerBack
      }}
    >
      {children}
    </GamepadNavContext.Provider>
  );
};
