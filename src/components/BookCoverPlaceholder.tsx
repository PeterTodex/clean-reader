import React from 'react';

/**
 * Curated classical bookish palettes to give books without covers
 * a distinct, elegant, and collectible appearance.
 */
const COVER_PALETTES = [
  { bg: '#334155', spine: '#1e293b', text: '#f8fafc', accent: '#94a3b8' }, // Ink Slate
  { bg: '#2b533f', spine: '#193829', text: '#f0fdf4', accent: '#86efac' }, // Forest Sage
  { bg: '#882233', spine: '#5c1320', text: '#fff1f2', accent: '#fca5a5' }, // Crimson Rose
  { bg: '#313866', spine: '#1e2246', text: '#e0e7ff', accent: '#a5b4fc' }, // Indigo Twilight
  { bg: '#1b5258', spine: '#0f363a', text: '#ecfeff', accent: '#67e8f9' }, // Deep Teal
  { bg: '#4a3525', spine: '#312115', text: '#fef3c7', accent: '#fcd34d' }, // Warm Espresso
  { bg: '#542654', spine: '#381638', text: '#fae8ff', accent: '#f0abfc' }, // Royal Plum
  { bg: '#2c406b', spine: '#1a2744', text: '#eff6ff', accent: '#93c5fd' }, // Muted Cobalt
  { bg: '#6c5327', spine: '#473514', text: '#fefce8', accent: '#fde047' }, // Bronze Ochre
  { bg: '#374151', spine: '#1f2937', text: '#f9fafb', accent: '#d1d5db' }, // Charcoal
];

function hashTitle(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Stand-in for a book cover that is missing or failed to load.
 *
 * Drawn as an SVG with a `viewBox` so it scales to whatever box it is dropped into.
 * The book title's first character and a deterministic color palette give each book
 * a distinct, high-quality appearance while making different books instantly recognizable.
 */
export const BookCoverPlaceholder: React.FC<{ title?: string; className?: string }> = ({
  title = '',
  className = '',
}) => {
  const cleanTitle = title.trim();
  const initial = cleanTitle.charAt(0) || '书';
  const paletteIndex = hashTitle(cleanTitle) % COVER_PALETTES.length;
  const palette = COVER_PALETTES[paletteIndex];

  return (
    <svg
      viewBox="0 0 100 125"
      preserveAspectRatio="xMidYMid meet"
      className={`w-full h-full book-cover-placeholder select-none ${className}`}
      style={{ backgroundColor: palette.bg }}
      role="img"
      aria-label={cleanTitle ? `${cleanTitle}（暂无封面）` : '暂无封面'}
    >
      {/* Hairline spine echoing a hardcover book's binding */}
      <rect
        x="0"
        y="0"
        width="4"
        height="125"
        className="book-cover-placeholder-spine"
        style={{ fill: palette.spine, opacity: 0.9 }}
      />

      {/* Subtle classical border frame */}
      <rect
        x="8"
        y="7"
        width="85"
        height="111"
        rx="2"
        fill="none"
        stroke={palette.accent}
        strokeWidth="0.5"
        className="book-cover-placeholder-frame"
        opacity="0.2"
      />

      {/* Decorative top header line */}
      <line
        x1="36"
        y1="32"
        x2="68"
        y2="32"
        stroke={palette.accent}
        strokeWidth="0.5"
        className="book-cover-placeholder-frame"
        opacity="0.2"
      />

      {/* Title First Character */}
      <text
        x="52"
        y="62"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="38"
        fontWeight="600"
        className="book-cover-placeholder-text font-serif select-none"
        style={{ fill: palette.text, opacity: 0.95 }}
      >
        {initial}
      </text>

      {/* Decorative bottom rule */}
      <line
        x1="36"
        y1="88"
        x2="68"
        y2="88"
        stroke={palette.accent}
        strokeWidth="0.5"
        className="book-cover-placeholder-frame"
        opacity="0.2"
      />
    </svg>
  );
};
