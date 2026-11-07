export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  size: number;
  alpha: number;
  vy: number;
  life: number;
  maxLife: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export class ParticleSystem {
  public floatingTexts: FloatingText[] = [];
  public particles: Particle[] = [];

  public addFloatingText(text: string, x: number, y: number, color: string = '#38bdf8', size: number = 20) {
    this.floatingTexts.push({
      id: Math.random().toString(36).substring(2, 9),
      text,
      x,
      y,
      color,
      size,
      alpha: 1.0,
      vy: -0.6,
      life: 0,
      maxLife: 1000 // ms
    });
  }

  public addClearParticles(y: number, width: number, color: string) {
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.0 + Math.random() * 3.0;
      this.particles.push({
        x: Math.random() * width,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.0,
        color,
        size: 3 + Math.random() * 4,
        alpha: 1.0,
        life: 0,
        maxLife: 600 + Math.random() * 300
      });
    }
  }

  public update(deltaMs: number) {
    // Update floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life += deltaMs;
      ft.y += ft.vy * (deltaMs / 16.67);
      ft.alpha = Math.max(0, 1.0 - ft.life / ft.maxLife);
      if (ft.life >= ft.maxLife) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += deltaMs;
      p.x += p.vx * (deltaMs / 16.67);
      p.y += p.vy * (deltaMs / 16.67);
      p.vy += 0.08 * (deltaMs / 16.67); // gravity
      p.alpha = Math.max(0, 1.0 - p.life / p.maxLife);
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D) {
    ctx.save();

    // Render particles
    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render floating texts
    for (const ft of this.floatingTexts) {
      ctx.globalAlpha = ft.alpha;
      ctx.fillStyle = ft.color;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 6;
      ctx.font = `bold ${ft.size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ft.text, ft.x, ft.y);
    }

    ctx.restore();
  }

  public clear() {
    this.floatingTexts = [];
    this.particles = [];
  }
}
