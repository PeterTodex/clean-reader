import React from 'react';

/**
 * Stand-in for a book cover that is missing or failed to load.
 *
 * Drawn as an SVG with a `viewBox` so it scales to whatever box it is dropped into — the three
 * call sites render at wildly different widths (80px in search results, 144–176px on the detail
 * page, fluid in the bookshelf) and a font-size based placeholder would need per-site tuning.
 *
 * The title's first character gives each book a distinct look while staying inside the app's
 * monochrome palette. Some sources can never supply a cover (see the banshanren adapter, which
 * serves encrypted image bytes), so this is a normal state, not an error state.
 */
export const BookCoverPlaceholder: React.FC<{ title?: string; className?: string }> = ({
  title,
  className = '',
}) => {
  const initial = (title || '').trim().charAt(0) || '书';

  return (
    <svg
      viewBox="0 0 100 125"
      preserveAspectRatio="xMidYMid meet"
      className={`w-full h-full bg-zinc-100 book-cover-placeholder ${className}`}
      style={{ backgroundColor: 'var(--bg-subtle)' }}
      role="img"
      aria-label={title ? `${title}（暂无封面）` : '暂无封面'}
    >
      {/* Hairline spine, echoing a book's binding. */}
      <rect
        x="0"
        y="0"
        width="2"
        height="125"
        className="book-cover-placeholder-spine fill-zinc-200"
        style={{ fill: 'var(--border-color)', opacity: 0.6 }}
      />
      <text
        x="52"
        y="64"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="42"
        className="book-cover-placeholder-text font-serif select-none"
        style={{ fill: 'var(--text-primary)', opacity: 0.45 }}
      >
        {initial}
      </text>
    </svg>
  );
};
