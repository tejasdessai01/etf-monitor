// Deterministic color-from-string → stable background per issuer/entity.
// Palette chosen for light-mode backgrounds: muted, non-competing with content.
const PALETTE = [
  '#475569', // slate
  '#0A3161', // navy (accent)
  '#1E6F50', // forest
  '#8A5A0B', // amber-deep
  '#7A3A3A', // brick
  '#4B3F72', // plum
  '#2F5D6B', // teal-deep
  '#5C4033', // sepia
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initials(name: string): string {
  const cleaned = name
    .replace(/\b(ETF|Trust|Fund|Inc\.?|Corp\.?|LLC|Ltd\.?|Co\.?|The)\b/gi, '')
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return name.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function IssuerAvatar({
  name,
  size = 'md',
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const bg = PALETTE[hash(name) % PALETTE.length];
  const cls = size === 'sm' ? 'avatar avatar-sm' : size === 'lg' ? 'avatar avatar-lg' : 'avatar';
  return (
    <span className={cls} style={{ background: bg }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
