// Decorative hero art: a customer-memory graph igniting. Pure SVG + CSS,
// no client JS. Node positions are hand-placed for composition.

const NODES: Array<{
  x: number;
  y: number;
  r: number;
  delay: number;
  label?: string;
  dim?: boolean;
}> = [
  { x: 300, y: 210, r: 10, delay: 0.2, label: "jane@acme.io" },
  { x: 180, y: 120, r: 6, delay: 0.7, label: "ZEN-42 error" },
  { x: 430, y: 110, r: 6, delay: 0.9, label: "firmware update" },
  { x: 120, y: 260, r: 5, delay: 1.2, label: "refund policy" },
  { x: 455, y: 275, r: 7, delay: 1.0, label: "resolved 07-01" },
  { x: 330, y: 350, r: 5, delay: 1.4, label: "pro plan" },
  { x: 205, y: 365, r: 4, delay: 1.6 },
  { x: 520, y: 190, r: 4, delay: 1.8, dim: true },
  { x: 70, y: 170, r: 3.5, delay: 2.0, dim: true },
  { x: 390, y: 40, r: 3.5, delay: 2.1, dim: true },
  { x: 150, y: 40, r: 3, delay: 2.3, dim: true },
  { x: 540, y: 350, r: 3, delay: 2.4, dim: true },
];

const EDGES: Array<[number, number, number]> = [
  [0, 1, 0.9],
  [0, 2, 1.1],
  [0, 3, 1.3],
  [0, 4, 1.15],
  [0, 5, 1.5],
  [1, 2, 1.7],
  [2, 4, 1.8],
  [3, 6, 1.9],
  [4, 7, 2.0],
  [1, 8, 2.2],
  [2, 9, 2.3],
];

export default function MemoryConstellation() {
  return (
    <svg
      viewBox="0 0 600 420"
      className="h-full w-full"
      role="img"
      aria-label="A customer memory graph: a customer node connected to their issues and resolutions"
    >
      <defs>
        <radialGradient id="ed-node-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a5b4fc" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </radialGradient>
      </defs>
      {EDGES.map(([a, b, delay], i) => (
        <line
          key={i}
          x1={NODES[a].x}
          y1={NODES[a].y}
          x2={NODES[b].x}
          y2={NODES[b].y}
          stroke="#6366f1"
          strokeOpacity="0.28"
          strokeWidth="1"
          className="ed-edge"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
      {NODES.map((n, i) => (
        <g key={i} className="ed-node" style={{ animationDelay: `${n.delay}s` }}>
          <circle cx={n.x} cy={n.y} r={n.r * 3.2} fill="url(#ed-node-glow)" opacity={n.dim ? 0.25 : 0.55} />
          <circle
            cx={n.x}
            cy={n.y}
            r={n.r}
            fill={n.dim ? "#3730a3" : i === 0 ? "#c7d2fe" : "#818cf8"}
          />
          {n.label ? (
            <text
              x={n.x + n.r + 8}
              y={n.y + 3.5}
              fill={i === 0 ? "#c7d2fe" : "#64748b"}
              fontSize={i === 0 ? 13 : 11}
              fontFamily="var(--font-geist-mono)"
            >
              {n.label}
            </text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}
