import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TimedExamModal } from '../TimedExamModal'
import type { QuizQuestion } from '../../../types'

// `AnimatePresence mode="wait"` holds the incoming phase back until the outgoing
// one finishes exiting, and that exit never completes under jsdom — so without
// this the modal is stuck on the setup screen for the whole test.
vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: ({ children, initial, animate, exit, ...rest }: Record<string, unknown> & { children?: React.ReactNode }) => (
      <div {...rest}>{children}</div>
    ),
  },
}))

const questions: QuizQuestion[] = [
  {
    id: 'q1',
    question: 'Q1',
    options: ['A) right', 'B) wrong'],
    correctAnswer: 'A',
    explanation: '',
    type: 'multiple-choice',
  },
  {
    id: 'q2',
    question: 'Q2',
    options: ['A) right', 'B) wrong'],
    correctAnswer: 'A',
    explanation: '',
    type: 'multiple-choice',
  },
]

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  questions,
  sourceTitle: 'Chapter 1',
  timeLimitMinutes: 1,
}

/** Advance fake timers inside act() so the countdown's state updates flush. */
const tick = async (seconds: number) => {
  await act(async () => {
    vi.advanceTimersByTime(seconds * 1000)
  })
}

describe('TimedExamModal', () => {
  beforeEach(() => {
    // shouldAdvanceTime keeps userEvent's own internal timers (and motion's rAF
    // scheduling) moving; without it the first click never settles.
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  // The countdown used to submit from inside the setState updater, which captured
  // `answers`/`timeRemaining` from the render where the exam started — so a timeout
  // always reported zero correct answers and "00:00 taken".
  it('reports answers given before the clock ran out', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const onComplete = vi.fn()

    render(<TimedExamModal {...baseProps} onComplete={onComplete} />)

    await user.click(screen.getByRole('button', { name: /start exam/i }))

    // The modal shuffles, so derive which question is actually on screen.
    const shownId = screen.getByText(/^Q[12]$/).textContent === 'Q1' ? 'q1' : 'q2'

    await user.click(screen.getByRole('button', { name: /A\) right/ }))
    await user.click(screen.getByRole('button', { name: /next question/i }))

    // Let the full 60s limit elapse so the exam auto-submits.
    await tick(61)

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith([shownId])
  })

  it('records the full time limit as time taken on a timeout', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(<TimedExamModal {...baseProps} />)

    await user.click(screen.getByRole('button', { name: /start exam/i }))
    await tick(61)

    expect(screen.getByText(/01:00 taken/)).toBeInTheDocument()
  })

  // Restarting after a timeout left `timeRemaining` at 0, which would make the
  // zero-check submit the new exam the instant it started.
  it('restarts with a full clock after a timed-out exam', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

    render(<TimedExamModal {...baseProps} />)

    await user.click(screen.getByRole('button', { name: /start exam/i }))
    await tick(61)

    await user.click(screen.getByRole('button', { name: /try again/i }))
    await user.click(screen.getByRole('button', { name: /start exam/i }))

    expect(screen.getByText('01:00')).toBeInTheDocument()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })
})
