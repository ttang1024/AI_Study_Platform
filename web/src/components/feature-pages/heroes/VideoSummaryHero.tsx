import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Check, Play, RotateCcw, X } from 'lucide-react';
import type { FeatureTheme } from '../theme';

/*
 * Real output, not mock-up copy: a summary, flashcards and quiz Toto Study generated in production
 * from this video, copied verbatim from the share below. Swap the whole block to change the example.
 */
const VIDEO = {
  title: 'Transformers, the tech behind LLMs | Deep Learning Chapter 5',
  id: 'wjZofJX0v4M',
  sharePath: '/share/9lowyLRmOJq6',
};

const at = (m: number, s: number) => m * 60 + s;
const LENGTH = at(26, 49); // where the generated timeline ends

const CHAPTERS = [
  { at: at(0, 0), summary: 'Generative Pretrained Transformers are designed to predict the next token in a sequence based on a probability distribution. While smaller models like GPT-2 often produce repetitive, nonsensical stories when repeatedly sampling from their own outputs, scaling the model size and computational capacity significantly improves coherence, allowing the system to generate logical narratives.' },
  { at: at(3, 8), summary: 'The data flow within a transformer begins with tokenization, where text is split into small pieces and mapped to high-dimensional vectors. These vectors pass through alternating attention layers, where words exchange context-dependent information to update their meanings, and feed-forward multi-layer perceptrons, repeating this cycle until the final vector is processed to produce a probability distribution for the next token.' },
  { at: at(6, 39), summary: 'Deep learning models utilize flexible structures with tunable parameters called weights, which are optimized using backpropagation on vast datasets rather than explicit coding. The data and weights are structured as multi-dimensional arrays, or tensors, and their interactions are executed through massive, parallel matrix-vector multiplications that transform the representations at each layer.' },
  { at: at(11, 14), summary: 'Word embedding matrices convert tokens into high-dimensional vectors where geometric directions correspond to semantic meanings. Within this vector space, conceptual relationships can be calculated using vector arithmetic (such as subtracting "man" from "woman" and adding "king" to approximate "queen") and evaluated quantitatively using dot products to measure similarity.' },
  { at: at(17, 57), summary: 'The final vector in the sequence is multiplied by an unembedding matrix to generate raw, unnormalized scores called logits for every word in the vocabulary. A softmax function normalizes these logits into a valid probability distribution, where an adjustable temperature parameter controls the randomness of the text generation by flattening or sharpening the resulting probabilities.' },
];

/** Short chapter headings: the timeline gives none, so these name what each span covers. */
const CHAPTER_TITLES = ['Predicting the next token', 'How data flows through a transformer', 'Weights, tensors and matrix multiplication', 'Word embeddings', 'Unembedding, softmax and temperature'];

/** `{{term}}` marks a cloze deletion, exactly as the generator writes it. */
const FLASHCARDS = [
  { front: 'What was the original use case for the transformer when it was introduced by Google in 2017?', back: 'Translating text from one language into another' },
  { front: 'In a transformer, the input is broken up into a bunch of little pieces called {{tokens}}.', back: 'Words, pieces of words, or other common character combinations' },
  { front: 'In the {{multi-layer perceptron}} (or feed-forward) block, vectors do not talk to each other but instead undergo the same operation in parallel.', back: 'Also known as MLP or feed-forward layer' },
  { front: 'How many parameters does the GPT-3 model contain?', back: '175 billion' },
  { front: 'What does the abbreviation GPT stand for?', back: 'Generative Pretrained Transformer' },
  { front: 'What is the purpose of the attention block in a transformer model?', back: 'It allows vectors to communicate with each other, passing information to update their values based on context.' },
];

const QUIZ = [
  {
    question: 'In a transformer-based model, how is the contextual meaning of a word like "model" adjusted when it appears in different phrases (such as "machine learning model" versus "fashion model")?',
    options: ['By mapping the word to a completely different static token vector before any processing begins.', 'Through the attention block, which allows token vectors to interact and update their values based on surrounding context.', 'Through the multi-layer perceptron block, which prevents vectors from interacting but dynamically re-scales their magnitudes.', 'By using a system prompt that explicitly defines the grammatical category of every noun in the sentence.'],
    correct: 1,
    explanation: 'The attention block is responsible for figuring out which words in context are relevant to updating the meanings of other words, allowing the vectors to pass information back and forth.',
  },
  {
    question: 'When a large language model like GPT-3 generates a multi-word story from a short initial prompt, what sequence of operations is occurring iteratively?',
    options: ['It generates the entire story at once, then uses attention blocks to iteratively refine the grammar of the output.', 'It predicts a single probability distribution for the entire passage, then decodes it word-by-word without updating the input.', 'It predicts the next token, samples from that distribution, appends the sampled token to the input text, and repeats the process.', 'It compares the seed text against a database of stories, retrieves the closest match, and translates it using a specialized translation block.'],
    correct: 2,
    explanation: 'Text generation is an iterative process: the model predicts a probability distribution for the next chunk of text, samples a token from it, appends that token to the input, and then runs the entire process again to make the next prediction.',
  },
  {
    question: 'What is a key operational difference between how vectors are processed in the attention blocks versus the multi-layer perceptron (feed-forward) blocks of a transformer?',
    options: ['Attention blocks process vectors in parallel, while multi-layer perceptrons process vectors sequentially one after another.', 'Attention blocks allow vectors to communicate and update each other, whereas multi-layer perceptrons process each vector independently in parallel.', 'Attention blocks only process text tokens, while multi-layer perceptrons are reserved for processing image and audio tokens.', 'Attention blocks reduce the dimensions of the vectors, while multi-layer perceptrons restore them to their original high-dimensional coordinates.'],
    correct: 1,
    explanation: 'In attention blocks, vectors talk to each other to update their values based on context. In multi-layer perceptrons (or feed-forward layers), the vectors do not talk to each other; they all go through the same operation independently in parallel.',
  },
];

const TABS = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'flashcards', label: `Flashcards · ${FLASHCARDS.length}` },
  { id: 'quiz', label: `Quiz · ${QUIZ.length}` },
] as const;
type Tab = (typeof TABS)[number]['id'];

const timestamp = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

type ThemeProps = { theme: FeatureTheme };

const Timeline: React.FC<ThemeProps & { active: number; onSelect: (i: number) => void }> = ({ theme, active, onSelect }) => (
  <div className="grid gap-1.5">
    {CHAPTERS.map((c, i) => (
      <button key={c.at} type="button" onClick={() => onSelect(i)} aria-expanded={i === active}
        className="text-left rounded-xl px-3.5 py-2.5 transition-colors"
        style={{ background: i === active ? theme.accentSoft : 'transparent', border: `1px solid ${i === active ? '#a5f3fc' : 'transparent'}` }}>
        <span className="flex items-center gap-3 text-sm font-semibold">
          <span className="font-mono text-xs px-1.5 py-0.5 rounded shrink-0" style={{ background: '#f1f5f9', color: theme.accentText }}>
            {timestamp(c.at)}
          </span>
          {CHAPTER_TITLES[i]}
        </span>
        <AnimatePresence initial={false}>
          {i === active && (
            <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden text-sm leading-relaxed pl-[3.9rem] pt-1" style={{ color: theme.muted }}>
              {c.summary}
            </motion.p>
          )}
        </AnimatePresence>
      </button>
    ))}
  </div>
);

/** Renders a cloze card: blanks on the front, the answer filled in and highlighted on the back. */
const Cloze: React.FC<ThemeProps & { text: string; revealed: boolean }> = ({ theme, text, revealed }) => (
  <>
    {text.split(/(\{\{[^}]+\}\})/g).map((part, i) => {
      const match = /^\{\{(.+)\}\}$/.exec(part);
      if (!match) return <React.Fragment key={i}>{part}</React.Fragment>;
      return revealed
        ? <mark key={i} className="rounded px-1" style={{ background: theme.accent, color: '#03202b' }}>{match[1]}</mark>
        : <span key={i} className="inline-block align-baseline rounded px-1 font-mono" style={{ background: theme.accentSoft, color: theme.accentText }}>[ … ]</span>;
    })}
  </>
);

const Flashcards: React.FC<ThemeProps> = ({ theme }) => {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = FLASHCARDS[index];
  const isCloze = card.front.includes('{{');
  const next = () => { setFlipped(false); setIndex((i) => (i + 1) % FLASHCARDS.length); };

  return (
    <div>
      <button type="button" onClick={() => setFlipped((f) => !f)} aria-label={flipped ? 'Show question' : 'Show answer'}
        className="w-full min-h-[11rem] text-left rounded-2xl p-5 flex flex-col justify-between gap-4"
        style={{ background: flipped ? theme.accentSoft : theme.surface, border: `1px solid ${theme.line}`, boxShadow: theme.cardShadow }}>
        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: theme.accentText }}>
          {flipped ? 'Answer' : isCloze ? 'Fill the blank' : 'Question'}
        </span>
        <span className="text-base font-semibold leading-snug">
          {isCloze ? <Cloze theme={theme} text={card.front} revealed={flipped} /> : flipped ? card.back : card.front}
        </span>
        {flipped && isCloze && <span className="text-sm" style={{ color: theme.muted }}>{card.back}</span>}
        <span className="flex items-center gap-1.5 text-xs" style={{ color: theme.muted }}>
          <RotateCcw className="w-3.5 h-3.5" /> Tap to {flipped ? 'see the question' : 'reveal'}
        </span>
      </button>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span style={{ color: theme.muted }}>Card {index + 1} of {FLASHCARDS.length}</span>
        <button type="button" onClick={next} className="inline-flex items-center gap-1 font-semibold" style={{ color: theme.accentText }}>
          Next card <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const Quiz: React.FC<ThemeProps> = ({ theme }) => {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const q = QUIZ[index];
  const next = () => { setPicked(null); setIndex((i) => (i + 1) % QUIZ.length); };

  return (
    <div>
      <p className="text-sm font-semibold leading-snug mb-3">{q.question}</p>
      <div className="grid gap-1.5">
        {q.options.map((option, i) => {
          const answered = picked !== null;
          const isCorrect = i === q.correct;
          const border = answered && isCorrect ? '#10b981' : answered && i === picked ? '#ef4444' : theme.line;
          return (
            <button key={option} type="button" disabled={answered} onClick={() => setPicked(i)}
              className="flex gap-2.5 text-left text-[13px] leading-snug rounded-xl px-3 py-2 transition-colors enabled:hover:bg-slate-50"
              style={{ border: `1px solid ${border}`, color: answered && !isCorrect && i !== picked ? theme.muted : theme.text }}>
              <span className="font-bold shrink-0 w-4">
                {answered && isCorrect ? <Check className="w-4 h-4 text-emerald-600" />
                  : answered && i === picked ? <X className="w-4 h-4 text-red-500" /> : String.fromCharCode(65 + i)}
              </span>
              {option}
            </button>
          );
        })}
      </div>
      <AnimatePresence initial={false}>
        {picked !== null && (
          <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden text-sm leading-relaxed pt-3" style={{ color: theme.muted }}>
            <strong style={{ color: picked === q.correct ? '#059669' : '#dc2626' }}>{picked === q.correct ? 'Correct. ' : 'Not quite. '}</strong>
            {q.explanation}
          </motion.p>
        )}
      </AnimatePresence>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span style={{ color: theme.muted }}>Question {index + 1} of {QUIZ.length}</span>
        {picked !== null && (
          <button type="button" onClick={next} className="inline-flex items-center gap-1 font-semibold" style={{ color: theme.accentText }}>
            Next question <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export const VideoSummaryHero: React.FC<ThemeProps> = ({ theme }) => {
  const [tab, setTab] = useState<Tab>('timeline');
  const [active, setActive] = useState(1);
  /** Set once a chapter is picked: the player reloads there and starts playing. */
  const [seekTo, setSeekTo] = useState<number | null>(null);
  const chapter = CHAPTERS[active];
  const end = CHAPTERS[active + 1]?.at ?? LENGTH;

  const selectChapter = (i: number) => {
    setActive(i);
    setSeekTo(CHAPTERS[i].at);
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="relative aspect-video rounded-2xl overflow-hidden bg-black" style={{ boxShadow: '0 30px 60px -20px rgba(15,23,42,0.35)' }}>
        <iframe key={seekTo ?? 'start'} title={VIDEO.title}
          src={`https://www.youtube-nocookie.com/embed/${VIDEO.id}?rel=0${seekTo === null ? '' : `&autoplay=1&start=${seekTo}`}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen
          className="absolute inset-0 w-full h-full" />
      </div>

      {/* Chapter segments: the gaps between them are the chapter breaks. Each one seeks the player. */}
      <div className="mt-3 flex gap-0.5 h-1.5">
        {CHAPTERS.map((c, i) => {
          const segmentEnd = CHAPTERS[i + 1]?.at ?? LENGTH;
          return (
            <button key={c.at} type="button" onClick={() => { selectChapter(i); setTab('timeline'); }} aria-label={`Play from ${CHAPTER_TITLES[i]}`}
              className="relative h-full rounded-sm overflow-hidden bg-slate-200 hover:bg-slate-300"
              style={{ width: `${((segmentEnd - c.at) / LENGTH) * 100}%` }}>
              {i <= active && (
                <motion.span layout className="absolute inset-y-0 left-0" style={{ background: theme.accent, width: i < active ? '100%' : '35%' }} />
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-medium" style={{ color: theme.muted }}>
        <span>{timestamp(chapter.at)} – {timestamp(end)}</span>
        <span>{timestamp(LENGTH)}</span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex gap-1 p-1 rounded-full" role="tablist" aria-label="Generated study material"
          style={{ background: theme.surface, border: `1px solid ${theme.line}`, boxShadow: theme.cardShadow }}>
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
              style={tab === t.id ? { background: theme.accentText, color: '#fff' } : { color: theme.muted }}>
              {t.label}
            </button>
          ))}
        </div>
        <span className="hidden sm:inline text-[11px] font-semibold uppercase tracking-wider" style={{ color: theme.accentText }}>Real output</span>
      </div>

      <div className="mt-3 lg:min-h-[27rem]" role="tabpanel">
        {tab === 'timeline' && <Timeline theme={theme} active={active} onSelect={selectChapter} />}
        {tab === 'flashcards' && <Flashcards theme={theme} />}
        {tab === 'quiz' && <Quiz theme={theme} />}
      </div>

      <a href={VIDEO.sharePath} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: theme.accentText }}>
        Open the full summary, mind map and cards <ArrowRight className="w-4 h-4" />
      </a>
    </div>
  );
};
