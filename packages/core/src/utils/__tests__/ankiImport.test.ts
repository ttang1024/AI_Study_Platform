import { describe, it, expect } from 'vitest'
import { parseAnkiExport } from '../ankiImport'

describe('parseAnkiExport', () => {
  it('parses tab-separated rows by default', () => {
    const rows = parseAnkiExport('Front1\tBack1\nFront2\tBack2')
    expect(rows).toEqual([
      { front: 'Front1', back: 'Back1', cardType: 'basic', tags: undefined },
      { front: 'Front2', back: 'Back2', cardType: 'basic', tags: undefined },
    ])
  })

  it('honors a #separator header', () => {
    const rows = parseAnkiExport('#separator:comma\nFront1,Back1')
    expect(rows).toEqual([{ front: 'Front1', back: 'Back1', cardType: 'basic', tags: undefined }])
  })

  it('ignores comment lines other than #separator', () => {
    const rows = parseAnkiExport('#html:true\nFront1\tBack1')
    expect(rows).toHaveLength(1)
  })

  it('falls back to semicolon or comma when no tab is present', () => {
    expect(parseAnkiExport('Front1;Back1')).toEqual([
      { front: 'Front1', back: 'Back1', cardType: 'basic', tags: undefined },
    ])
    expect(parseAnkiExport('Front1,Back1')).toEqual([
      { front: 'Front1', back: 'Back1', cardType: 'basic', tags: undefined },
    ])
  })

  it('skips rows with fewer than 2 columns', () => {
    expect(parseAnkiExport('OnlyOneField')).toEqual([])
  })

  it('skips rows with an empty front or back after cleaning', () => {
    expect(parseAnkiExport('\tBack1')).toEqual([])
    expect(parseAnkiExport('Front1\t')).toEqual([])
  })

  it('strips HTML and decodes entities in fields', () => {
    const rows = parseAnkiExport('Front <b>bold</b><br>line\tBack &amp; more')
    expect(rows[0].front).toBe('Front bold\nline')
    expect(rows[0].back).toBe('Back & more')
  })

  it('detects cloze markup and tags the row cardType accordingly', () => {
    const rows = parseAnkiExport('{{c1::Paris}} is the capital\tFrance')
    expect(rows[0].cardType).toBe('cloze')
  })

  it('parses tags from the last column, capped at 10 tags of length <= 40', () => {
    const rows = parseAnkiExport('Front1\tBack1\ttagA tagB')
    expect(rows[0].tags).toEqual(['tagA', 'tagB'])
  })

  it('omits tags when the tag column is empty', () => {
    const rows = parseAnkiExport('Front1\tBack1\t')
    expect(rows[0].tags).toBeUndefined()
  })
})
