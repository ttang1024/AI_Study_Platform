import React, { useState } from 'react';
import { Quote, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { SourceCitation as Citation } from '@core/types';
import { formatTimecode } from '@core/utils/format';

interface Props {
  citation?: Citation;
  /** Document or video this artifact belongs to, used to build the jump link. */
  documentId?: string;
  videoId?: string;
  className?: string;
}

const formatTimestamp = formatTimecode;

/**
 * Attribution for an AI-generated artifact: the passage it came from, and a link to that spot in
 * the source when we were able to locate it.
 *
 * Renders nothing without a citation. Older artifacts and anything whose supporting quote failed
 * to resolve simply have none — that absence is meaningful and must not be papered over with a
 * guessed link.
 */
export const SourceCitation: React.FC<Props> = ({ citation, documentId, videoId, className = '' }) => {
  const [expanded, setExpanded] = useState(false);

  if (!citation) return null;

  // Only offer a jump when there is somewhere to land. Video pages honour `?t=` by seeking the
  // player; document pages honour `?highlight=` by opening the Source tab on that character range.
  // A citation whose quote could not be located has no offsets and stays quote-only.
  // `!= null` throughout, never `!== undefined`: the API serializes an unresolved offset as an
  // explicit null, which passes an undefined check and yields a link to position zero.
  const isLocated = citation.startOffset != null && citation.endOffset != null;
  const hasTimestamp = citation.startSeconds != null;

  const href =
    videoId && hasTimestamp
      ? `/videos/${videoId}?t=${Math.floor(citation.startSeconds!)}`
      : documentId && isLocated
        ? `/documents/${documentId}?highlight=${citation.startOffset}-${citation.endOffset}`
        : null;

  const locationLabel =
    hasTimestamp
      ? formatTimestamp(citation.startSeconds!)
      : citation.page != null
        ? `page ${citation.page}`
        : 'the source';

  const positionNote = href ? null : 'Quoted from this document; the exact position could not be resolved.';

  return (
    <div className={`text-xs border-l-2 border-border pl-3 py-1 ${className}`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="inline-flex items-center gap-1.5 text-text-muted hover:text-text-main transition-colors"
        aria-expanded={expanded}
      >
        <Quote className="w-3 h-3 shrink-0" />
        <span>{expanded ? 'Hide source' : 'Show source'}</span>
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5">
          <blockquote className="italic text-text-muted leading-relaxed">“{citation.quote}”</blockquote>
          {href ? (
            <Link to={href} className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700">
              Jump to {locationLabel} <ExternalLink className="w-3 h-3" />
            </Link>
          ) : (
            positionNote && <span className="text-text-muted">{positionNote}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default SourceCitation;
