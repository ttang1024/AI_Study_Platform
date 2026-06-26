import React, { forwardRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ShareableQuiz, ShareableCard } from '../../services/shareContentService';
import { MindMapDiagram, mindMapRenderWidth } from './MindMapDiagram';

// Horizontal padding applied inside the header/body/footer (40px each side).
const SIDE_PAD = 40;
// Default readable content width when there is no (wide) mind map.
const BASE_CONTENT = 520;
// Largest mind-map SVG width we render; bounds the whole card width too.
const MAP_MAX = 1040;
// border (1px×2) + inner padding (12px×2) around the mind-map SVG.
const MAP_BOX_EXTRA = 26;

export interface ShareImageContent {
  title: string;
  summary?: string | null;
  mindMapText?: string | null;
  notesHtml?: string | null;
  quizzes?: ShareableQuiz[] | null;
  flashcards?: ShareableCard[] | null;
}

interface ShareImageCardProps {
  content: ShareImageContent;
}

const Section: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ marginTop: 24 }}>
    <div
      style={{
        display: 'inline-block',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        color: '#059669',
        background: '#ecfdf5',
        borderRadius: 8,
        padding: '4px 10px',
        marginBottom: 12,
      }}
    >
      {label}
    </div>
    {children}
  </div>
);

/**
 * Off-screen render target captured by html-to-image to produce a single
 * long shareable image. Uses explicit colors (not CSS variables) so the
 * rasterized output is stable regardless of theme.
 */
export const ShareImageCard = forwardRef<HTMLDivElement, ShareImageCardProps>(
  ({ content }, ref) => {
    const { title, summary, mindMapText, notesHtml, quizzes, flashcards } = content;

    // Drive one shared content width off the mind map (the only module wide
    // enough to need it), so every module lines up at the same width instead of
    // the map jutting out wider than the text blocks.
    const mapW = mindMapText ? mindMapRenderWidth(mindMapText, MAP_MAX) : 0;
    const contentWidth = Math.max(BASE_CONTENT, mapW ? mapW + MAP_BOX_EXTRA : 0);
    const cardWidth = contentWidth + SIDE_PAD * 2;

    return (
      <div
        ref={ref}
        style={{
          // Fixed, mind-map-driven width so all modules share one content width
          // and the map renders at native resolution (crisp when enlarged).
          width: cardWidth,
          background: '#ffffff',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          color: '#18181b',
        }}
      >
        {/* Header banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            padding: '32px 40px',
            color: '#ffffff',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.85, letterSpacing: 0.5 }}>
            toto.ai · AI Study Platform
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 10, lineHeight: 1.3 }}>
            {title}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '8px 40px 32px' }}>
          {summary && (
            <Section label="Summary">
              <div style={{ fontSize: 15, lineHeight: 1.7, color: '#3f3f46' }} className="share-md">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
              </div>
            </Section>
          )}

          {mindMapText && (
            <Section label="Mind Map">
              <div
                style={{
                  border: '1px solid #e4e4e7',
                  borderRadius: 12,
                  background: '#ffffff',
                  padding: 12,
                }}
              >
                <MindMapDiagram text={mindMapText} maxWidth={MAP_MAX} />
              </div>
            </Section>
          )}

          {notesHtml && (
            <Section label="Notes">
              <div
                style={{ fontSize: 15, lineHeight: 1.7, color: '#3f3f46' }}
                className="share-md"
                dangerouslySetInnerHTML={{ __html: notesHtml }}
              />
            </Section>
          )}

          {flashcards && flashcards.length > 0 && (
            <Section label={`Flashcards · ${flashcards.length}`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {flashcards.map((card, i) => (
                  <div
                    key={i}
                    style={{
                      border: '1px solid #e4e4e7',
                      borderRadius: 12,
                      padding: '14px 16px',
                      background: '#fafafa',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#18181b' }}>
                      {card.front}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        color: '#52525b',
                        marginTop: 8,
                        paddingTop: 8,
                        borderTop: '1px dashed #e4e4e7',
                      }}
                    >
                      {card.back}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {quizzes && quizzes.length > 0 && (
            <Section label={`Quiz · ${quizzes.length}`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {quizzes.map((q, i) => (
                  <div
                    key={i}
                    style={{
                      border: '1px solid #e4e4e7',
                      borderRadius: 12,
                      padding: '14px 16px',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#18181b' }}>
                      {i + 1}. {q.question}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                      {q.options.map((opt, j) => {
                        const isCorrect = opt === q.correctAnswer;
                        return (
                          <div
                            key={j}
                            style={{
                              fontSize: 13,
                              color: isCorrect ? '#15803d' : '#52525b',
                              fontWeight: isCorrect ? 700 : 400,
                              background: isCorrect ? '#f0fdf4' : 'transparent',
                              border: isCorrect ? '1px solid #bbf7d0' : '1px solid transparent',
                              borderRadius: 8,
                              padding: '6px 10px',
                            }}
                          >
                            {isCorrect ? '✓ ' : ''}
                            {opt}
                          </div>
                        );
                      })}
                    </div>
                    {q.explanation && (
                      <div style={{ fontSize: 12, color: '#71717a', marginTop: 10, lineHeight: 1.6 }}>
                        {q.explanation}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: '1px solid #e4e4e7',
            padding: '18px 40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>toto.ai</div>
          <div style={{ fontSize: 12, color: '#a1a1aa' }}>Generated by AI Study Platform</div>
        </div>
      </div>
    );
  },
);

ShareImageCard.displayName = 'ShareImageCard';
