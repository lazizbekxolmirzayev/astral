import type { NBodyState } from '@/physics/gravity';

/** Interactive 2D view of an n-body state: trails, zoom, pan, selection. */

const BODY_COLORS: Record<string, string> = {
  sun: '#ffd166', mercury: '#a99a8b', venus: '#e8bd70', earth: '#58a6ff', mars: '#e27655',
  jupiter: '#d2ad83', saturn: '#e2cc8a', uranus: '#82d3d9', neptune: '#637bea',
  asteroid: '#dbdbdb', 'test-particle': '#56dbcc', 'black-hole': '#050509', star: '#ffd166', planet: '#58a6ff',
};

function colorFor(id: string): string {
  const known = BODY_COLORS[id];
  if (known) return known;
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 70% 68%)`;
}

const MAX_TRAIL = 520;

export type SandboxView = {
  zoom: number;
  panX: number;
  panY: number;
  selectedId: string | null;
  showVectors: boolean;
  showTrails: boolean;
  /** Reset zoom/pan/trails (new scenario). */
  fit(): void;
  clearTrails(): void;
  /** Record current positions into trails (call only while time advances). */
  sample(state: NBodyState, centerId: string | undefined): void;
  draw(canvas: HTMLCanvasElement, state: NBodyState, centerId: string | undefined, hiddenLabel: string): void;
  /** Screen-space picking; returns a body id or null. */
  pick(canvas: HTMLCanvasElement, state: NBodyState, centerId: string | undefined, clientX: number, clientY: number): string | null;
  zoomAt(canvas: HTMLCanvasElement, clientX: number, clientY: number, factor: number): void;
  setOptions(options: { selectedId: string | null; showTrails: boolean; showVectors: boolean }): void;
  dragStart(x: number, y: number): void;
  dragMove(x: number, y: number): void;
  /** Ends a drag; true if the pointer actually moved (so it was a pan, not a click). */
  dragEnd(): boolean;
};

export function niceStep(target: number): number {
  const exp = Math.floor(Math.log10(target));
  const base = target / 10 ** exp;
  const m = base < 1.5 ? 1 : base < 3.5 ? 2 : base < 7.5 ? 5 : 10;
  return m * 10 ** exp;
}

export function formatDistanceAu(au: number): string {
  if (au >= 0.01) return `${Number(au.toPrecision(3))} AU`;
  const km = au * 149597870.7;
  if (km >= 1000) return `${Math.round(km).toLocaleString('en-US')} km`;
  return `${Number(km.toPrecision(3))} km`;
}

export function createSandboxView(): SandboxView {
  const trails = new Map<string, number[]>();
  let smoothExtent = 0;
  let lastCanvasRect = { width: 1, height: 1 };

  let drag: { x: number; y: number; moved: boolean } | null = null;

  const view: SandboxView = {
    zoom: 1, panX: 0, panY: 0, selectedId: null, showVectors: false, showTrails: true,
    fit() { view.zoom = 1; view.panX = 0; view.panY = 0; smoothExtent = 0; },
    clearTrails() { trails.clear(); },
    setOptions(o) { view.selectedId = o.selectedId; view.showTrails = o.showTrails; view.showVectors = o.showVectors; },
    dragStart(x, y) { drag = { x, y, moved: false }; },
    dragMove(x, y) {
      if (!drag) return;
      const dx = x - drag.x;
      const dy = y - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      if (drag.moved) { view.panX += dx; view.panY += dy; drag.x = x; drag.y = y; }
    },
    dragEnd() { const moved = drag?.moved ?? false; drag = null; return moved; },

    sample(state, centerId) {
      const c = Math.max(0, centerId ? state.ids.indexOf(centerId) : 0);
      const cx = state.positions[c * 3] as number;
      const cy = state.positions[c * 3 + 1] as number;
      for (let i = 0; i < state.ids.length; i += 1) {
        if (i === c) continue;
        const id = state.ids[i] as string;
        let list = trails.get(id);
        if (!list) { list = []; trails.set(id, list); }
        list.push((state.positions[i * 3] as number) - cx, (state.positions[i * 3 + 1] as number) - cy);
        if (list.length > MAX_TRAIL * 2) list.splice(0, 2);
      }
    },

    draw(canvas, state, centerId, hiddenLabel) {
      const rect = canvas.getBoundingClientRect();
      lastCanvasRect = { width: rect.width, height: rect.height };
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(rect.width * dpr));
      const h = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const bg = ctx.createRadialGradient(rect.width / 2, rect.height / 2, 0, rect.width / 2, rect.height / 2, Math.max(rect.width, rect.height) * 0.7);
      bg.addColorStop(0, '#0e1424');
      bg.addColorStop(1, '#05070d');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, rect.width, rect.height);
      // Fixed deterministic backdrop stars (do not move with the view).
      let seed = 1234567;
      for (let i = 0; i < 90; i += 1) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const sx = (seed / 4294967296) * rect.width;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const sy = (seed / 4294967296) * rect.height;
        ctx.fillStyle = `rgba(255,255,255,${0.15 + ((i * 37) % 10) / 30})`;
        ctx.fillRect(sx, sy, 1, 1);
      }
      if (state.ids.length === 0) return;

      const c = Math.max(0, centerId ? state.ids.indexOf(centerId) : 0);
      const cx = state.positions[c * 3] as number;
      const cy = state.positions[c * 3 + 1] as number;
      let extent = 0;
      for (let i = 0; i < state.ids.length; i += 1) {
        extent = Math.max(extent, Math.hypot((state.positions[i * 3] as number) - cx, (state.positions[i * 3 + 1] as number) - cy));
      }
      extent = Math.max(extent, 1e-9);
      smoothExtent = smoothExtent === 0 ? extent : smoothExtent + (extent - smoothExtent) * 0.08;
      const fitExtent = Math.max(smoothExtent, extent * 0.999);
      const scale = (Math.min(rect.width, rect.height) * 0.42 / fitExtent) * view.zoom;
      const ox = rect.width / 2 + view.panX;
      const oy = rect.height / 2 + view.panY;
      const sx = (x: number) => ox + x * scale;
      const sy = (y: number) => oy - y * scale;

      // Distance rings around the central body.
      const ringStep = niceStep(130 / scale);
      ctx.font = '10px ui-monospace, monospace';
      ctx.textBaseline = 'alphabetic';
      for (let k = 1; k <= 40; k += 1) {
        const radius = k * ringStep * scale;
        if (radius > Math.hypot(rect.width, rect.height)) break;
        ctx.beginPath();
        ctx.arc(ox, oy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(120,160,220,0.10)';
        ctx.lineWidth = 1;
        ctx.stroke();
        if (k <= 6 && ox + radius < rect.width - 40) {
          ctx.fillStyle = 'rgba(150,180,230,0.45)';
          ctx.fillText(formatDistanceAu(k * ringStep), ox + radius + 3, oy - 3);
        }
      }

      // Trails.
      if (view.showTrails) {
        for (let i = 0; i < state.ids.length; i += 1) {
          if (i === c) continue;
          const id = state.ids[i] as string;
          const list = trails.get(id);
          if (!list || list.length < 4) continue;
          const n = list.length / 2;
          const chunks = 8;
          const per = Math.ceil(n / chunks);
          const colour = colorFor(id);
          ctx.lineWidth = id === view.selectedId ? 1.8 : 1.1;
          for (let ch = 0; ch < chunks; ch += 1) {
            const a = ch * per;
            const b = Math.min(n - 1, a + per);
            if (a >= b) break;
            ctx.beginPath();
            ctx.moveTo(sx(list[a * 2] as number), sy(list[a * 2 + 1] as number));
            for (let j = a + 1; j <= b; j += 1) ctx.lineTo(sx(list[j * 2] as number), sy(list[j * 2 + 1] as number));
            ctx.globalAlpha = 0.08 + 0.7 * ((ch + 1) / chunks);
            ctx.strokeStyle = colour;
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      }

      // Bodies.
      const gmCenter = Math.max(state.gm[c] as number, 1e-30);
      const gmFloor = 1e-15;
      const labelled: Array<[number, number]> = [];
      for (let i = 0; i < state.ids.length; i += 1) {
        const id = state.ids[i] as string;
        const x = sx((state.positions[i * 3] as number) - cx);
        const y = sy((state.positions[i * 3 + 1] as number) - cy);
        if (x < -50 || y < -50 || x > rect.width + 50 || y > rect.height + 50) continue;
        const gm = state.gm[i] as number;
        const t = gm > 0 ? Math.min(1, Math.max(0, (Math.log10(gm / gmFloor)) / Math.max(1e-6, Math.log10(gmCenter / gmFloor)))) : 0;
        const radius = i === c ? 6 + 4 * t : 2.5 + 3.5 * t;
        const colour = colorFor(id);
        if (id === 'black-hole') {
          const halo = ctx.createRadialGradient(x, y, radius * 0.6, x, y, radius * 3.2);
          halo.addColorStop(0, 'rgba(255,179,71,0.75)');
          halo.addColorStop(1, 'rgba(108,92,231,0)');
          ctx.fillStyle = halo;
          ctx.beginPath(); ctx.arc(x, y, radius * 3.2, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = '#000'; ctx.fill();
          ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 1.5; ctx.stroke();
        } else {
          const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
          glow.addColorStop(0, colour);
          glow.addColorStop(0.35, `${i === c ? 'rgba(255,209,102,0.35)' : 'rgba(180,210,255,0.14)'}`);
          glow.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = glow;
          ctx.beginPath(); ctx.arc(x, y, radius * 3, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = colour; ctx.fill();
        }
        if (id === view.selectedId) {
          ctx.beginPath(); ctx.arc(x, y, radius + 6, 0, Math.PI * 2);
          ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
        }
        if (view.showVectors && i !== c) {
          const vx = (state.velocities[i * 3] as number) - (state.velocities[c * 3] as number);
          const vy = (state.velocities[i * 3 + 1] as number) - (state.velocities[c * 3 + 1] as number);
          const speed = Math.hypot(vx, vy);
          if (speed > 0) {
            const len = Math.min(60, 26 + 0) ;
            const ex = x + (vx / speed) * len;
            const ey = y - (vy / speed) * len;
            ctx.strokeStyle = '#f5b041'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
            const ang = Math.atan2(ey - y, ex - x);
            ctx.beginPath();
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex - 6 * Math.cos(ang - 0.4), ey - 6 * Math.sin(ang - 0.4));
            ctx.lineTo(ex - 6 * Math.cos(ang + 0.4), ey - 6 * Math.sin(ang + 0.4));
            ctx.closePath(); ctx.fillStyle = '#f5b041'; ctx.fill();
          }
        }
        const crowded = labelled.some(([lx, ly]) => Math.abs(lx - x) < 64 && Math.abs(ly - y) < 13);
        if (id === view.selectedId || !crowded) {
          labelled.push([x, y]);
          ctx.fillStyle = id === view.selectedId ? '#00f0ff' : 'rgba(212,217,229,0.85)';
          ctx.font = '11px ui-monospace, monospace';
          ctx.fillText(id === 'test-particle' ? hiddenLabel || id : id, x + radius + 5, y + 4);
        }
      }

      // Scale bar.
      const barAu = niceStep(110 / scale);
      const barPx = barAu * scale;
      const by = rect.height - 18;
      ctx.strokeStyle = 'rgba(220,230,255,0.8)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(16, by); ctx.lineTo(16 + barPx, by);
      ctx.moveTo(16, by - 4); ctx.lineTo(16, by + 4); ctx.moveTo(16 + barPx, by - 4); ctx.lineTo(16 + barPx, by + 4); ctx.stroke();
      ctx.fillStyle = 'rgba(220,230,255,0.8)'; ctx.font = '11px ui-monospace, monospace';
      ctx.fillText(formatDistanceAu(barAu), 16, by - 8);
    },

    pick(canvas, state, centerId, clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      const c = Math.max(0, centerId ? state.ids.indexOf(centerId) : 0);
      const cx = state.positions[c * 3] as number;
      const cy = state.positions[c * 3 + 1] as number;
      let extent = 1e-9;
      for (let i = 0; i < state.ids.length; i += 1) extent = Math.max(extent, Math.hypot((state.positions[i * 3] as number) - cx, (state.positions[i * 3 + 1] as number) - cy));
      const fitExtent = Math.max(smoothExtent, extent * 0.999);
      const scale = (Math.min(rect.width, rect.height) * 0.42 / fitExtent) * view.zoom;
      let best: string | null = null;
      let bestD = 16;
      for (let i = 0; i < state.ids.length; i += 1) {
        const x = rect.width / 2 + view.panX + ((state.positions[i * 3] as number) - cx) * scale;
        const y = rect.height / 2 + view.panY - ((state.positions[i * 3 + 1] as number) - cy) * scale;
        const d = Math.hypot(x - px, y - py);
        if (d < bestD) { bestD = d; best = state.ids[i] as string; }
      }
      return best;
    },

    zoomAt(canvas, clientX, clientY, factor) {
      const rect = canvas.getBoundingClientRect();
      const px = clientX - rect.left - rect.width / 2;
      const py = clientY - rect.top - rect.height / 2;
      const next = Math.min(2000, Math.max(0.05, view.zoom * factor));
      const k = next / view.zoom;
      view.panX = px - (px - view.panX) * k;
      view.panY = py - (py - view.panY) * k;
      view.zoom = next;
      void lastCanvasRect;
    },
  };
  return view;
}
