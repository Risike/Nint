import React from 'react';
import { useGamepadNav } from '../../context/GamepadNavContext';
import { useI18n } from '../../i18n/useI18n';

export const GamepadBar: React.FC = () => {
  const { gamepadConnected, isGameplayActive } = useGamepadNav();
  const { t } = useI18n();

  if (!gamepadConnected || isGameplayActive) return null;

  return (
    <div className="gamepad-helper-bar">
      <div className="gamepad-helper-item">
        <span className="gamepad-pill">LB</span>
        <span className="gamepad-pill">RB</span>
        <span className="gamepad-label">{t('Tabs')}</span>
      </div>
      <div className="gamepad-helper-item">
        <span className="gamepad-pill">LT</span>
        <span className="gamepad-label">{t('Mute')}</span>
      </div>
      <div className="gamepad-helper-item">
        <span className="gamepad-pill">RT</span>
        <span className="gamepad-label">{t('Fullscreen')}</span>
      </div>
      <div className="gamepad-helper-item">
        <span className="gamepad-pill">{t('D-Pad / Stick')}</span>
        <span className="gamepad-label">{t('Move')}</span>
      </div>
      <div className="gamepad-helper-item">
        <span className="gamepad-pill gamepad-pill-a">A</span>
        <span className="gamepad-label">{t('Select')}</span>
      </div>
      <div className="gamepad-helper-item">
        <span className="gamepad-pill gamepad-pill-b">B</span>
        <span className="gamepad-label">{t('Back')}</span>
      </div>
      <div className="gamepad-helper-item gamepad-helper-item--scroll">
        <span className="gamepad-pill">RS</span>
        <span className="gamepad-label">{t('Right Stick Scroll')}</span>
      </div>
    </div>
  );
};
