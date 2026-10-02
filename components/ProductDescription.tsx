'use client';

import { useId, useState } from 'react';

export function ProductDescription({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false);
  const descriptionId = useId();
  const hasMore = description.length > 500;
  const preview = description.slice(0, 500);
  const lastSpace = preview.search(/\s+\S*$/);
  const excerpt = lastSpace > 400 ? preview.slice(0, lastSpace) : preview;

  if (!description.trim()) return null;

  return (
    <div className="mt-5">
      <p id={descriptionId} className="whitespace-pre-wrap break-words leading-7 text-muted">
        {hasMore && !expanded ? `${excerpt.trimEnd()}?` : description}
      </p>
      {hasMore && (
        <button type="button" aria-expanded={expanded} aria-controls={descriptionId}
          onClick={() => setExpanded(value => !value)}
          className="mt-3 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}
