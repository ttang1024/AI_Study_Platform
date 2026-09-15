import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { WorkedProblemsPanel } from '../WorkedProblemsPanel';
import { workedProblemsService, WorkedProblem } from '../../services/workedProblemsService';

vi.mock('../../services/workedProblemsService', async () => {
  const actual = await vi.importActual<typeof import('../../services/workedProblemsService')>(
    '../../services/workedProblemsService'
  );
  return { ...actual, workedProblemsService: { getProblems: vi.fn(), generateProblems: vi.fn() } };
});

const problem: WorkedProblem = {
  workedProblemId: 'p1',
  problemText: 'The real data $x$ is drawn from $\\mathcal{N}(5, 1)$.',
  steps: [{ stepNumber: 1, description: 'Shift the mean by $\\theta$.', formula: '\\theta = 5' }],
  finalAnswer: 'The optimal value is $\\theta = 5$.',
  difficulty: 'medium',
  topic: 'GANs',
  createdAt: '2026-09-15T00:00:00Z',
};

describe('WorkedProblemsPanel', () => {
  beforeEach(() => {
    vi.mocked(workedProblemsService.getProblems).mockResolvedValue([problem]);
  });

  it('renders LaTeX in the problem, steps and final answer as KaTeX, not raw source', async () => {
    const user = userEvent.setup();
    const { container } = render(<WorkedProblemsPanel documentId="d1" />);

    await screen.findByText('GANs');
    expect(container.querySelector('.katex')).not.toBeNull();
    // KaTeX keeps the TeX source in a hidden MathML <annotation>, so assert on the
    // visible .katex-html layer instead of the whole textContent.
    const visibleText = () =>
      Array.from(container.querySelectorAll('.katex-html')).map(n => n.textContent).join('');
    expect(visibleText()).toContain('N');

    await user.click(screen.getByText('GANs'));
    await user.click(screen.getByText('Show Step 1'));
    await user.click(screen.getByText('Show Final Answer'));

    // The bare-LaTeX step formula becomes a display-math block.
    expect(container.querySelector('.katex-display')).not.toBeNull();
    expect(visibleText()).toContain('θ');
    expect(container.querySelector('code')).toBeNull();
  });
});
