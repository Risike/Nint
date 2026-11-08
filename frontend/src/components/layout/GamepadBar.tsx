import React from 'react';
import { useGamepadNav } from '../../context/GamepadNavContext';

export const GamepadBar: React.FC = () => {
  const { gamepadConnected, isGameplayActive } = useGamepadNav();

  if (!gamepadConnected || isGameplayActive) return null;

  return (
    <div className="gamepad-helper-bar">
      <div className="gamepad-helper-item">
        <span className="gamepad-pill">LB</span>
        <span className="gamepad-pill">RB</span>
        <span className="gamepad-label">Tabs</span>
      </div>
      <div className="gamepad-helper-item">
        <span className="gamepad-pill">D-Pad / Stick</span>
        <span className="gamepad-label">Move</span>
      </div>
      <div className="gamepad-helper-item">
        <span className="gamepad-pill gamepad-pill-a">A</span>
        <span className="gamepad-label">Select</span>
      </div>
      <div className="gamepad-helper-item">
        <span className="gamepad-pill gamepad-pill-b">B</span>
        <span className="gamepad-label">Back</span>
      </div>
    </div>
  );
};
