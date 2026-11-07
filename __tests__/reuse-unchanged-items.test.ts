import { reuseUnchangedItems } from '@/lib/utils/reuse-unchanged-items'

type Item = { id: string; likes: number; nested?: { a: number } }

describe('reuseUnchangedItems', () => {
  it('returns the previous array when every item is unchanged', () => {
    const prev: Item[] = [
      { id: '1', likes: 1, nested: { a: 1 } },
      { id: '2', likes: 2 },
    ]
    const next: Item[] = JSON.parse(JSON.stringify(prev))

    expect(reuseUnchangedItems(prev, next)).toBe(prev)
  })

  it('reuses unchanged items and keeps changed ones from the new data', () => {
    const prev: Item[] = [
      { id: '1', likes: 1 },
      { id: '2', likes: 2 },
    ]
    const next: Item[] = [
      { id: '1', likes: 1 },
      { id: '2', likes: 3 },
    ]

    const result = reuseUnchangedItems(prev, next)

    expect(result).not.toBe(prev)
    expect(result[0]).toBe(prev[0])
    expect(result[1]).toBe(next[1])
  })

  it('handles inserted, removed and reordered items', () => {
    const prev: Item[] = [
      { id: '1', likes: 1 },
      { id: '2', likes: 2 },
      { id: '3', likes: 3 },
    ]
    const next: Item[] = [
      { id: 'new', likes: 0 },
      { id: '3', likes: 3 },
      { id: '1', likes: 1 },
    ]

    const result = reuseUnchangedItems(prev, next)

    expect(result.map((item) => item.id)).toEqual(['new', '3', '1'])
    expect(result[0]).toBe(next[0])
    expect(result[1]).toBe(prev[2])
    expect(result[2]).toBe(prev[0])
  })

  it('returns next as-is when either side is empty', () => {
    const next: Item[] = [{ id: '1', likes: 1 }]
    expect(reuseUnchangedItems([], next)).toBe(next)
    const empty: Item[] = []
    expect(reuseUnchangedItems(next, empty)).toBe(empty)
  })
})
