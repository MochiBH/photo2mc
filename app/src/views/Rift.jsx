import { useId, useRef } from 'react';
import { useDrawIn } from '../fx/draw';
import { cn } from '../wm/utils';

/* Summoner's Rift as a schematic. Map units run 0..14800 with blue base bottom-left; the drawing is 148 units square, y flipped. */
export const toMap = (x, y) => [x / 100, 148 - y / 100];
export const PITS = { baron: [50.1, 43.3], dragon: [98.7, 103.9] };
const TURRETS = {
  blue: [[981, 10441], [1512, 6699], [1169, 4287], [5846, 6396], [5048, 4812], [3651, 3696], [10504, 1029], [6919, 1483], [4281, 1253]],
  red: [[4318, 13875], [7943, 13411], [10481, 13650], [8955, 8510], [9767, 10113], [11134, 11207], [13866, 4505], [13327, 8226], [13624, 10572]],
};
const BUFFS = [[3800, 7900, 's1'], [7800, 4100, 's2'], [11000, 6900, 's1'], [7100, 10900, 's2']];
const LANES = 'M11 104 V22 Q11 11 22 11 H104 M44 137 H126 Q137 137 137 126 V44 M36 112 L112 36';
const mix = (a, pct, b = 'var(--map)') => `color-mix(in oklab, ${a} ${pct}%, ${b})`;

/* The map is up to three drawings stacked in one frame: the Rift itself, an optional layer under the marks (`under`, used
   for the heat glow), and the marks on top (`children`). Each of the two upper drawings is its own layer, so a pulsing ring
   or a dot popping in redraws only that thin layer and not the whole map beneath it. */
export function RiftBase({ label, className, labels = true, under, children }) {
  const id = useId().replace(/:/g, ''), root = useRef(null);
  useDrawIn(root);
  return (
    <div className={cn('relative overflow-hidden rounded-3xl ring-1 ring-foreground/10', className)} style={{ background: 'var(--map)' }}>
    <svg ref={root} viewBox="0 0 148 148" role="img" aria-label={label} className="block h-auto w-full">
      <defs>
        <linearGradient id={id + 'river'} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--map-river)" stopOpacity=".75" />
          <stop offset=".5" stopColor="var(--map-river)" stopOpacity=".45" />
          <stop offset="1" stopColor="var(--map-river)" stopOpacity=".75" />
        </linearGradient>
        <radialGradient id={id + 'blue'} cx="0" cy="1" r="1"><stop offset="0" stopColor={mix('var(--s1)', 55)} /><stop offset="1" stopColor={mix('var(--s1)', 14)} /></radialGradient>
        <radialGradient id={id + 'red'} cx="1" cy="0" r="1"><stop offset="0" stopColor={mix('var(--bad)', 55)} /><stop offset="1" stopColor={mix('var(--bad)', 14)} /></radialGradient>
        <pattern id={id + 'grain'} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <circle cx="1.5" cy="1.5" r=".55" fill="var(--foreground)" fillOpacity=".07" />
        </pattern>
      </defs>
      <rect width="148" height="148" fill={`url(#${id}grain)`} />
      {/* river with its two pits */}
      <path d="M20 20 L128 128" fill="none" stroke={mix('var(--foreground)', 16)} strokeWidth="16" strokeLinecap="round" />
      <path data-draw d="M20 20 L128 128" fill="none" stroke={`url(#${id}river)`} strokeWidth="13.5" strokeLinecap="round" />
      {Object.entries(PITS).map(([k, [x, y]]) => (
        <g key={k}>
          <circle cx={x} cy={y} r="8.4" fill={mix('var(--foreground)', 16)} />
          <circle cx={x} cy={y} r="7.2" fill={mix('var(--map-river)', 55)} />
        </g>
      ))}
      {/* lanes */}
      <path d={LANES} fill="none" stroke={mix('var(--foreground)', 14)} strokeWidth="9.5" strokeLinecap="round" />
      {LANES.split(' M').map((d, i) => <path key={i} data-draw d={(i ? 'M' : '') + d} fill="none" stroke="var(--map-lane)" strokeWidth="7.5" strokeLinecap="round" />)}
      <path d={LANES} fill="none" stroke={mix('var(--foreground)', 10, 'var(--map-lane)')} strokeWidth=".5" strokeDasharray="1.5 2.5" strokeLinecap="round" />
      {/* bases */}
      <circle cx="0" cy="148" r="44" fill={`url(#${id}blue)`} stroke={mix('var(--s1)', 45)} strokeWidth=".8" />
      <circle cx="148" cy="0" r="44" fill={`url(#${id}red)`} stroke={mix('var(--bad)', 45)} strokeWidth=".8" />
      <circle cx="14" cy="134" r="4.2" fill="var(--s1)" stroke="var(--map)" strokeWidth="1.2" />
      <circle cx="134" cy="14" r="4.2" fill="var(--bad)" stroke="var(--map)" strokeWidth="1.2" />
      {/* turrets and buff camps */}
      {Object.entries(TURRETS).map(([side, list]) => list.map(([x, y]) => { const [cx, cy] = toMap(x, y); return (
        <rect data-pop key={side + x} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} x={cx - 1.5} y={cy - 1.5} width="3" height="3" rx=".6" transform={`rotate(45 ${cx} ${cy})`} fill={side === 'blue' ? 'var(--s1)' : 'var(--bad)'} stroke="var(--map)" strokeWidth=".6" fillOpacity=".85" />
      ); }))}
      {BUFFS.map(([x, y, c]) => { const [cx, cy] = toMap(x, y); return <circle key={x} cx={cx} cy={cy} r="2.2" fill="none" stroke={`var(--${c})`} strokeOpacity=".55" strokeWidth=".9" />; })}
      {labels && (
        <g fill="var(--muted-foreground)" fontSize="3.6" fontWeight="700" style={{ letterSpacing: '.08em', textTransform: 'uppercase' }}>
          <text x="26" y="8.6">Top</text><text x="122" y="145.6" textAnchor="end">Bot</text>
          <text x="80" y="70" transform="rotate(-45 80 70)" textAnchor="middle">Mid</text>
          <text x={PITS.baron[0]} y={PITS.baron[1] - 10} textAnchor="middle">Baron</text>
          <text x={PITS.dragon[0]} y={PITS.dragon[1] + 12.6} textAnchor="middle">Dragon</text>
        </g>
      )}
    </svg>
    {under && <svg viewBox="0 0 148 148" aria-hidden="true" className="rift-layer rift-under">{under}</svg>}
    {children && <svg viewBox="0 0 148 148" className="rift-layer">{children}</svg>}
    </div>
  );
}
