import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LibraryAssignMenu, type AssignSelectionItem } from '../LibraryAssignMenu'
import type { LibraryTag } from '../../../services/libraryTagsService'

const getTags = vi.fn()
const assignItems = vi.fn()
const unassignItems = vi.fn()
const createTag = vi.fn()

vi.mock('../../../services/libraryTagsService', () => ({
  libraryTagsService: {
    getTags: (...args: unknown[]) => getTags(...args),
    assignItems: (...args: unknown[]) => assignItems(...args),
    unassignItems: (...args: unknown[]) => unassignItems(...args),
    createTag: (...args: unknown[]) => createTag(...args),
  },
}))

const makeTag = (id: string, name: string, kind: 'tag' | 'collection' = 'collection'): LibraryTag => ({
  libraryTagId: id,
  name,
  kind,
  color: null,
  description: null,
  itemCount: 0,
  createdAt: '2026-08-01T00:00:00Z',
})

const selectionOf = (...tagIdSets: string[][]): AssignSelectionItem[] =>
  tagIdSets.map((tagIds, i) => ({
    ref: { itemKind: 'document' as const, itemId: `doc-${i}` },
    tagIds,
  }))

const openMenu = async () => {
  await userEvent.click(screen.getByRole('button', { name: /add to collection/i }))
  await screen.findByText('Biology')
}

describe('LibraryAssignMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getTags.mockResolvedValue({ data: { data: [makeTag('t1', 'Biology'), makeTag('t2', 'Exam', 'tag')] } })
    assignItems.mockResolvedValue({ data: { message: 'Added 2 items to "Biology".' } })
    unassignItems.mockResolvedValue({ data: { message: 'Removed 2 items from "Biology".' } })
  })

  it('loads tags only once the menu is opened', async () => {
    render(<LibraryAssignMenu selection={selectionOf([])} onChanged={vi.fn()} />)
    expect(getTags).not.toHaveBeenCalled()
    await openMenu()
    expect(getTags).toHaveBeenCalled()
  })

  it('assigns only the items that do not already carry the tag', async () => {
    const onChanged = vi.fn()
    // Second item is already in Biology, so only the first should be sent.
    render(<LibraryAssignMenu selection={selectionOf([], ['t1'])} onChanged={onChanged} />)
    await openMenu()
    await userEvent.click(screen.getByText('Biology'))

    await waitFor(() => expect(assignItems).toHaveBeenCalledWith('t1', [
      { itemKind: 'document', itemId: 'doc-0' },
    ]))
    expect(unassignItems).not.toHaveBeenCalled()
    expect(onChanged).toHaveBeenCalledWith('Added 2 items to "Biology".')
  })

  it('removes the tag when every selected item already carries it', async () => {
    render(<LibraryAssignMenu selection={selectionOf(['t1'], ['t1'])} onChanged={vi.fn()} />)
    await openMenu()
    await userEvent.click(screen.getByText('Biology'))

    await waitFor(() => expect(unassignItems).toHaveBeenCalledWith('t1', [
      { itemKind: 'document', itemId: 'doc-0' },
      { itemKind: 'document', itemId: 'doc-1' },
    ]))
    expect(assignItems).not.toHaveBeenCalled()
  })

  it('creates a collection and assigns the whole selection to it', async () => {
    createTag.mockResolvedValue({ data: { data: makeTag('t3', 'New Deck') } })
    render(<LibraryAssignMenu selection={selectionOf([], [])} onChanged={vi.fn()} />)
    await openMenu()

    await userEvent.type(screen.getByPlaceholderText('New name…'), 'New Deck')
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }))

    await waitFor(() => expect(createTag).toHaveBeenCalledWith({ name: 'New Deck', kind: 'collection' }))
    expect(assignItems).toHaveBeenCalledWith('t3', [
      { itemKind: 'document', itemId: 'doc-0' },
      { itemKind: 'document', itemId: 'doc-1' },
    ])
  })

  it('surfaces a failed assignment instead of reporting success', async () => {
    assignItems.mockRejectedValue({ response: { data: { message: 'Tag at most 500 items at a time.' } } })
    const onChanged = vi.fn()
    render(<LibraryAssignMenu selection={selectionOf([])} onChanged={onChanged} />)
    await openMenu()
    await userEvent.click(screen.getByText('Biology'))

    expect(await screen.findByText('Tag at most 500 items at a time.')).toBeInTheDocument()
    expect(onChanged).not.toHaveBeenCalled()
  })
})
