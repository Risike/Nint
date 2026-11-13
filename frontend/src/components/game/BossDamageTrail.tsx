import React from 'react';

export interface BossDamageSpark {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
}

interface BossDamageTrailProps {
  sparks: BossDamageSpark[];
}

type SparkStyle = React.CSSProperties & {
  '--boss-dx': string;
  '--boss-dy': string;
};

export const BossDamageTrail: React.FC<BossDamageTrailProps> = ({ sparks }) => {
  if (sparks.length === 0) return null;

  return (
    <div className="boss-damage-trail" aria-hidden="true">
      {sparks.map((spark) => {
        const style: SparkStyle = {
          left: `${spark.startX}px`,
          top: `${spark.startY}px`,
          width: `${spark.size}px`,
          height: `${spark.size}px`,
          backgroundColor: spark.color,
          color: spark.color,
          animationDelay: `${spark.delay}ms`,
          animationDuration: `${spark.duration}ms`,
          '--boss-dx': `${spark.endX - spark.startX}px`,
          '--boss-dy': `${spark.endY - spark.startY}px`
        };

        return <span key={spark.id} className="boss-damage-spark" style={style} />;
      })}
    </div>
  );
};