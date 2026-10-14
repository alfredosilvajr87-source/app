// Ícone de pod descartável com cor estável por produto (substitui a foto do produto)
const COLORS = ['#a78bfa', '#f472b6', '#38bdf8', '#fb7185', '#34d399', '#fbbf24', '#818cf8', '#22d3ee'];

const pick = (seed = '') => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
};

const VapeIcon = ({ seed, size = 26 }) => {
  const c = pick(seed);
  return (
    <svg width={size * 0.62} height={size} viewBox="0 0 16 26" aria-hidden="true" className="flex-shrink-0">
      <rect x="5.5" y="0.5" width="5" height="4" rx="1.5" fill="#d4d4e4" />
      <rect x="2" y="4" width="12" height="21.5" rx="3" fill={c} />
      <rect x="4" y="7" width="2" height="12" rx="1" fill="#fff" fillOpacity="0.45" />
      <rect x="2" y="19" width="12" height="2" fill="#0e0e1a" fillOpacity="0.35" />
    </svg>
  );
};

export default VapeIcon;
