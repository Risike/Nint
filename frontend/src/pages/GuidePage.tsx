import React, { useState } from 'react';
import { ArrowLeft, BookOpen, Bomb, Bot, Gamepad2, Skull, Users, type LucideIcon } from 'lucide-react';
import { useI18n } from '../i18n/useI18n';
import { useGamepadBack } from '../context/GamepadNavContext';

interface GuidePageProps {
  onNavigate: (tab: string) => void;
}

interface GuideTopic {
  id: string;
  /** English source string, translated through the i18n dictionary. */
  title: string;
  text: string;
}

interface GuideMode {
  id: string;
  title: string;
  play: string;
  win: string;
  score: string;
}

interface GuideCategory {
  id: string;
  title: string;
  intro?: string;
  icon: LucideIcon;
  modes: GuideMode[];
}

const BASICS: readonly GuideTopic[] = [
  {
    id: 'controls',
    title: 'General Controls',
    text: 'Move with the arrow keys, hard drop with Space, rotate with Up/X and Z/Ctrl, hold with C or Shift, and pause with Escape. Every keyboard key and gamepad button can be remapped in Settings.'
  },
  {
    id: 'scoring',
    title: 'Scoring Basics',
    text: 'Clearing several lines at once pays more. Back-to-back Tetrises, T-Spins and Perfect Clears multiply your score, and each consecutive clear adds a combo bonus. In multiplayer, clears also send garbage to your opponent.'
  },
  {
    id: 'credits',
    title: 'Credits',
    text: 'Each cleared line in Classic (except Practice), Versus CPU, Boss Battle, online versus and Co-op Boss earns one credit for the Shop. Practice and Blast award no credits.'
  }
];

const GUIDE: readonly GuideCategory[] = [
  {
    id: 'classic',
    title: 'Classic',
    icon: Gamepad2,
    modes: [
      {
        id: 'marathon',
        title: 'Marathon',
        play: 'Start at level 1 and clear lines while gravity speeds up every ten lines.',
        win: 'Clear 150 lines before your stack reaches the top.',
        score: 'Points come from line clears multiplied by your level; Tetrises, T-Spins, combos and Perfect Clears are worth the most.'
      },
      {
        id: 'sprint',
        title: 'Sprint (40 Lines)',
        play: 'Build a flat stack and clear lines as fast as you can; the clock runs from the first piece.',
        win: 'Clear 40 lines. The leaderboard ranks your best time, not your score.',
        score: 'Clears still score points, but only your finishing time counts towards the ranking.'
      },
      {
        id: 'ultra',
        title: 'Ultra',
        play: 'Play for three minutes and score as many points as possible.',
        win: 'There is no line goal: survive the timer and make every second count.',
        score: 'Chase high-value clears such as Tetrises, T-Spins, back-to-back chains and combos.'
      },
      {
        id: 'practice',
        title: 'Practice',
        play: 'Endless play with optional fixed speed, anti-game-over protection, starting garbage lines and lock delay presets.',
        win: 'There is nothing to win: practise the setups you want without pressure.',
        score: 'Points and playtime are tracked, but Practice has no leaderboard and awards no credits.'
      }
    ]
  },
  {
    id: 'cpu',
    title: 'Versus CPU',
    icon: Bot,
    modes: [
      {
        id: 'cpu-duel',
        title: 'Versus CPU',
        play: 'Pick a difficulty level and duel the CPU. Higher levels place pieces faster and stack more cleanly.',
        win: 'Make the CPU top out. Send garbage often and keep your own stack low.',
        score: 'Clears score normally and also send garbage: a Tetris sends four lines and T-Spins send up to six.'
      }
    ]
  },
  {
    id: 'boss',
    title: 'Boss Battle',
    icon: Skull,
    modes: [
      {
        id: 'boss-duel',
        title: 'Boss Battle',
        play: 'Each boss attacks every 30 seconds with garbage, inverted controls, locked rotation, blur, extra speed or a hidden ghost piece. Every second attack it applies makes it faster, and a Tetris cancels the next attack.',
        win: 'Empty the boss health bar before your stack tops out. Each victory unlocks the next boss and carries your score over.',
        score: 'Every point of score deals one point of damage, so dense high-value clears empty the health bar fastest.'
      }
    ]
  },
  {
    id: 'blast',
    title: 'Blast',
    intro: 'Blast adds bombs to the pieces: completing a row no longer removes it, it detonates the bombs inside it instead. The explosion clears everything around each bomb, gravity drops the leftovers and chains can set off more bombs. Four small bombs on an O piece fuse into a mega bomb.',
    icon: Bomb,
    modes: [
      {
        id: 'blast-adventure',
        title: 'Adventure',
        play: 'Fifty stages, each with a stock of 100 pieces. Detonate bombs to break the stage layout.',
        win: 'Destroy the stage blocks with explosions before you run out of pieces.',
        score: 'Explosions, chains and leftover pieces add to the score used in the Adventure leaderboard.'
      },
      {
        id: 'blast-training',
        title: 'Training',
        play: 'Endless bomb practice with four upcoming pieces and the speed of your choice.',
        win: 'No goal: experiment with blast shapes and chain reactions at your own pace.',
        score: 'Training is not ranked; the score is only feedback while you practise.'
      },
      {
        id: 'blast-fight',
        title: 'Fight',
        play: 'Eight rounds against eight enemies. Enemies raise columns, eat bombs, add blocks, freeze your controls or blow strips out of your stack.',
        win: 'Reduce each enemy health to zero. Crushing blocks hurts it a little, explosions hurt much more.',
        score: 'Damage comes from cleared rows: more rows at once and longer chains deal far more. Health carries over between rounds.'
      },
      {
        id: 'blast-duel',
        title: 'Blast Battle (1v1)',
        play: 'Duel another player on two bomb-filled boards. Both players receive the same pieces and bombs at a fixed speed, and every ten destroyed blocks or bombs sends one garbage row to the opponent.',
        win: 'Take a round by emptying your whole board or by making your opponent top out. The first player to win three rounds takes the best-of-five duel.',
        score: 'Blast awards no credits and no rating: only the rounds decide the winner. Garbage rows can only be removed by blasting them.'
      }
    ]
  },
  {
    id: 'online',
    title: 'Multiplayer',
    intro: 'Online duels use the same rules as solo play: both players receive the same pieces and send garbage to each other.',
    icon: Users,
    modes: [
      {
        id: 'online-quick',
        title: 'Quick Play',
        play: 'Get matched with another player and start as soon as both sides are ready.',
        win: 'Top out your opponent, or be the last one standing if they leave.',
        score: 'Clears send garbage: doubles one line, triples two, Tetrises four, T-Spin doubles four, plus combo and back-to-back bonuses. Incoming garbage cancels your attack first.'
      },
      {
        id: 'online-ranked',
        title: 'Ranked Match',
        play: 'A rated duel against a player of similar rating. The server creates the match and both reports must agree.',
        win: 'Win to gain rating. If you leave, you lose rating and your opponent gains none.',
        score: 'The duel scoring is unchanged; the ladder uses your ELO rating, not your score. Co-op cannot be ranked.'
      },
      {
        id: 'online-room',
        title: 'Private Room',
        play: 'Create a room, share the six-character code, and your opponent joins with it.',
        win: 'Same duel rules as Quick Play, with no rating at stake.',
        score: 'Scoring and garbage are identical to Quick Play; use a code to play with a friend.'
      },
      {
        id: 'coop',
        title: 'Co-op Boss Battle',
        play: 'Two players share one boss with 1.5 times its normal health. The boss attacks on a timer and both boards can counter it.',
        win: 'Bring the boss health to zero together, then vote to retry or move to the next boss.',
        score: 'Damage comes from both boards, so clear together and decide who blocks each attack.'
      }
    ]
  }
];

export const GuidePage: React.FC<GuidePageProps> = ({ onNavigate }) => {
  const { t } = useI18n();
  const [activeId, setActiveId] = useState<string>(BASICS[0].id);

  useGamepadBack(() => {
    onNavigate('home');
    return true;
  }, [onNavigate]);

  // Keep the active topic visible in the horizontal chip strip on mobile
  // without moving the page when the entry is already on screen.
  const selectTopic = (id: string, element: HTMLElement) => {
    setActiveId(id);
    element.scrollIntoView({ block: 'nearest', inline: 'center' });
  };

  const activeBasics = BASICS.find((topic) => topic.id === activeId) ?? null;
  const activeSelection = activeBasics
    ? null
    : GUIDE
      .map((category) => ({ category, mode: category.modes.find((mode) => mode.id === activeId) }))
      .find((entry) => entry.mode !== undefined) ?? null;

  const ActiveCategoryIcon = activeSelection?.category.icon;

  return (
    <div style={{ width: '100%', maxWidth: '1050px', marginTop: '1rem' }}>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => onNavigate('home')}
        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1.25rem' }}
      >
        <ArrowLeft size={16} aria-hidden="true" /> {t('Back to home')}
      </button>

      <header style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
        <div style={{
          display: 'inline-flex',
          padding: '0.65rem',
          borderRadius: '50%',
          background: 'rgba(59, 130, 246, 0.2)',
          color: 'var(--accent-blue)',
          marginBottom: '0.55rem'
        }}>
          <BookOpen size={26} aria-hidden="true" />
        </div>
        <h1 style={{ fontSize: '2.3rem', fontWeight: 800, marginBottom: '0.35rem' }}>{t('Game Guide')}</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
          {t('How to play, how to win and how to score in every mode.')}
        </p>
      </header>

      <div className="guide-layout">
        <aside className="guide-sidebar">
          <nav className="guide-nav" aria-label={t('Contents')}>
            <div className="guide-nav-group">
              <p className="guide-nav-title">{t('Basics')}</p>
              {BASICS.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  className={`guide-nav-link${activeId === topic.id ? ' is-active' : ''}`}
                  aria-current={activeId === topic.id ? 'true' : undefined}
                  onClick={(event) => selectTopic(topic.id, event.currentTarget)}
                >
                  {t(topic.title)}
                </button>
              ))}
            </div>

            {GUIDE.map((category) => {
              // A single mode already named like its category does not need the
              // group heading repeated above it.
              const showGroupTitle = !(category.modes.length === 1 && category.modes[0].title === category.title);
              return (
              <div key={category.id} className="guide-nav-group">
                {showGroupTitle && <p className="guide-nav-title">{t(category.title)}</p>}
                {category.modes.map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={`guide-nav-link${activeId === mode.id ? ' is-active' : ''}`}
                    aria-current={activeId === mode.id ? 'true' : undefined}
                    onClick={(event) => selectTopic(mode.id, event.currentTarget)}
                  >
                    {t(mode.title)}
                  </button>
                ))}
              </div>
              );
            })}
          </nav>
        </aside>

        <article className="guide-article" aria-live="polite">
          {activeBasics ? (
            <>
              <p className="guide-kicker">
                <BookOpen size={14} aria-hidden="true" /> {t('Basics')}
              </p>
              <h2>{t(activeBasics.title)}</h2>
              <p className="guide-lead" style={{ marginBottom: 0 }}>{t(activeBasics.text)}</p>
            </>
          ) : activeSelection?.mode ? (
            <>
              <p className="guide-kicker">
                {ActiveCategoryIcon && <ActiveCategoryIcon size={14} aria-hidden="true" />}
                {t(activeSelection.category.title)}
              </p>
              <h2>{t(activeSelection.mode.title)}</h2>
              {activeSelection.category.intro && (
                <p className="guide-lead">{t(activeSelection.category.intro)}</p>
              )}

              <div className="guide-block">
                <h3 className="guide-block-label">{t('How to play')}</h3>
                <p>{t(activeSelection.mode.play)}</p>
              </div>
              <div className="guide-block">
                <h3 className="guide-block-label">{t('How to win')}</h3>
                <p>{t(activeSelection.mode.win)}</p>
              </div>
              <div className="guide-block">
                <h3 className="guide-block-label">{t('Scoring')}</h3>
                <p>{t(activeSelection.mode.score)}</p>
              </div>
            </>
          ) : null}
        </article>
      </div>
    </div>
  );
};
