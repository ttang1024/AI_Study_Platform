import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EditorToolbar, EDITOR_EXTENSIONS, ToolbarBtn } from '../editorToolbar'

/** A stand-in for the tiptap editor, recording the chain the toolbar drives. */
const fakeEditor = (active: string[] = [], attrs: Record<string, unknown> = {}) => {
  const calls: string[] = []
  const chain: Record<string, () => typeof chain> = {}
  for (const command of [
    'focus', 'toggleBold', 'toggleItalic', 'toggleBulletList', 'toggleOrderedList', 'run',
  ]) {
    chain[command] = () => { calls.push(command); return chain }
  }
  const editor = {
    calls,
    chain: () => chain,
    isActive: (name: string) => active.includes(name),
    getAttributes: () => attrs,
  }
  // setColor/unsetColor/setFontSize are added by extensions, so they live on the chain too.
  for (const command of ['setColor', 'unsetColor', 'setFontSize']) {
    chain[command] = () => { calls.push(command); return chain }
  }
  return editor
}

describe('EDITOR_EXTENSIONS', () => {
  it('is the one extension set every rich-text surface writes with', () => {
    // Both editors must agree, or one writes HTML the other cannot render.
    expect(EDITOR_EXTENSIONS.length).toBeGreaterThanOrEqual(4)
    expect(EDITOR_EXTENSIONS.some(e => (e as { name?: string }).name === 'fontSize')).toBe(true)
  })
})

describe('ToolbarBtn', () => {
  it('runs its command on mousedown, so the editor keeps focus', async () => {
    const onClick = vi.fn()
    render(<ToolbarBtn onClick={onClick} title="Bold">B</ToolbarBtn>)

    await userEvent.setup().click(screen.getByTitle('Bold'))

    expect(onClick).toHaveBeenCalledOnce()
  })

  it('marks itself when the mark is active at the cursor', () => {
    const { rerender } = render(<ToolbarBtn onClick={vi.fn()} title="Bold">B</ToolbarBtn>)
    expect(screen.getByTitle('Bold').className).not.toContain('bg-zinc-200')

    rerender(<ToolbarBtn active onClick={vi.fn()} title="Bold">B</ToolbarBtn>)
    expect(screen.getByTitle('Bold').className).toContain('bg-zinc-200')
  })
})

describe('EditorToolbar', () => {
  it('offers the formatting controls both editors share', () => {
    render(<EditorToolbar editor={fakeEditor()} />)

    expect(screen.getByTitle('Font size')).toBeInTheDocument()
    expect(screen.getByTitle('Bold')).toBeInTheDocument()
    expect(screen.getByTitle('Italic')).toBeInTheDocument()
    expect(screen.getByTitle('Bullet list')).toBeInTheDocument()
    expect(screen.getByTitle('Numbered list')).toBeInTheDocument()
    expect(screen.getByTitle('Text color')).toBeInTheDocument()
  })

  it.each([
    ['Bold', 'toggleBold'],
    ['Italic', 'toggleItalic'],
    ['Bullet list', 'toggleBulletList'],
    ['Numbered list', 'toggleOrderedList'],
  ])('drives %s through the editor chain', async (title, command) => {
    const editor = fakeEditor()
    render(<EditorToolbar editor={editor} />)

    await userEvent.setup().click(screen.getByTitle(title))

    expect(editor.calls).toContain(command)
    expect(editor.calls).toContain('run')
  })

  it('reflects the marks active at the cursor', () => {
    render(<EditorToolbar editor={fakeEditor(['bold', 'bulletList'])} />)

    expect(screen.getByTitle('Bold').className).toContain('bg-zinc-200')
    expect(screen.getByTitle('Italic').className).not.toContain('bg-zinc-200')
    expect(screen.getByTitle('Bullet list').className).toContain('bg-zinc-200')
  })

  it('defaults the font size to 14 when the cursor carries none', () => {
    render(<EditorToolbar editor={fakeEditor()} />)
    expect(screen.getByTitle('Font size')).toHaveTextContent('14')
  })

  it('shows the font size at the cursor', () => {
    render(<EditorToolbar editor={fakeEditor([], { fontSize: '24px' })} />)
    expect(screen.getByTitle('Font size')).toHaveTextContent('24')
  })

  it('applies a picked font size', async () => {
    const editor = fakeEditor()
    render(<EditorToolbar editor={editor} />)
    const user = userEvent.setup()

    await user.click(screen.getByTitle('Font size'))
    await user.click(screen.getByText('32'))

    expect(editor.calls).toContain('setFontSize')
  })

  it('applies and resets the text colour', async () => {
    const editor = fakeEditor()
    render(<EditorToolbar editor={editor} />)
    const user = userEvent.setup()

    await user.click(screen.getByTitle('Text color'))
    await user.click(screen.getByTitle('#ff0000'))
    expect(editor.calls).toContain('setColor')

    await user.click(screen.getByTitle('Text color'))
    await user.click(screen.getByText('Reset color'))
    expect(editor.calls).toContain('unsetColor')
  })

  it('closes an open picker on a click outside it', async () => {
    render(<EditorToolbar editor={fakeEditor()} />)
    const user = userEvent.setup()

    await user.click(screen.getByTitle('Font size'))
    expect(screen.getByText('32')).toBeInTheDocument()

    await user.click(document.body)
    expect(screen.queryByText('32')).not.toBeInTheDocument()
  })

  it('slots extra content at the end of the row, for the note editor save indicator', () => {
    render(<EditorToolbar editor={fakeEditor()}><span>Saved</span></EditorToolbar>)
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })
})
