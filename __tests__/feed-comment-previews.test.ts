import type { WorkoutCommentPreviewRow } from '@/lib/database'
import { createCommentPreviewLoader } from '@/lib/utils/feed-comment-previews'

const comment = (workoutId: string, id: string): WorkoutCommentPreviewRow => ({
  id,
  workout_id: workoutId,
  user_id: 'u1',
  content: `comment ${id}`,
  created_at: '2026-01-01T00:00:00Z',
  profile: { id: 'u1', display_name: 'U', user_tag: 'u', avatar_url: null },
  likeCount: 0,
  isLiked: false,
})

const flushTimers = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('createCommentPreviewLoader', () => {
  it('batches loads issued in the same tick into one fetch', async () => {
    const fetchPreviews = jest.fn(async (ids: string[]) =>
      Object.fromEntries(ids.map((id) => [id, [comment(id, `${id}-c1`)]])),
    )
    const loader = createCommentPreviewLoader(fetchPreviews)

    const results = await Promise.all([
      loader.load('w1', 'viewer', 1),
      loader.load('w2', 'viewer', 1),
      loader.load('w3', 'viewer', 1),
    ])

    expect(fetchPreviews).toHaveBeenCalledTimes(1)
    expect(fetchPreviews.mock.calls[0][0]).toEqual(['w1', 'w2', 'w3'])
    expect(fetchPreviews.mock.calls[0][1]).toBe('viewer')
    expect(results.map((r) => r[0].id)).toEqual(['w1-c1', 'w2-c1', 'w3-c1'])
  })

  it('serves cached previews until the comment count changes', async () => {
    const fetchPreviews = jest.fn(async (ids: string[]) =>
      Object.fromEntries(ids.map((id) => [id, [comment(id, 'c')]])),
    )
    const loader = createCommentPreviewLoader(fetchPreviews)

    await loader.load('w1', 'viewer', 2)
    expect(loader.peek('w1', 'viewer', 2)).toHaveLength(1)
    await loader.load('w1', 'viewer', 2)
    expect(fetchPreviews).toHaveBeenCalledTimes(1)

    // A new comment arrived: the cached preview is stale.
    expect(loader.peek('w1', 'viewer', 3)).toBeUndefined()
    await loader.load('w1', 'viewer', 3)
    expect(fetchPreviews).toHaveBeenCalledTimes(2)
  })

  it('expires cached previews after the TTL', async () => {
    let now = 1_000
    const fetchPreviews = jest.fn(async (ids: string[]) =>
      Object.fromEntries(ids.map((id) => [id, []])),
    )
    const loader = createCommentPreviewLoader(fetchPreviews, () => now)

    await loader.load('w1', 'viewer', 0)
    now += 59_000
    expect(loader.peek('w1', 'viewer', 0)).toEqual([])
    now += 2_000
    expect(loader.peek('w1', 'viewer', 0)).toBeUndefined()
  })

  it('keeps caches separate per viewer and flushes when the viewer changes', async () => {
    const fetchPreviews = jest.fn(async (ids: string[]) =>
      Object.fromEntries(ids.map((id) => [id, []])),
    )
    const loader = createCommentPreviewLoader(fetchPreviews)

    await Promise.all([loader.load('w1', 'a', 1), loader.load('w1', 'b', 1)])

    expect(fetchPreviews).toHaveBeenCalledTimes(2)
    expect(fetchPreviews.mock.calls.map((call) => call[1])).toEqual(['a', 'b'])
    expect(loader.peek('w1', 'a', 1)).toEqual([])
    expect(loader.peek('w1', 'b', 1)).toEqual([])
  })

  it('rejects every waiter in the batch when the fetch fails, without caching', async () => {
    const fetchPreviews = jest.fn(async () => {
      throw new Error('offline')
    })
    const loader = createCommentPreviewLoader(fetchPreviews)

    const first = loader.load('w1', 'viewer', 1)
    const second = loader.load('w2', 'viewer', 1)
    await expect(first).rejects.toThrow('offline')
    await expect(second).rejects.toThrow('offline')
    await flushTimers()
    expect(loader.peek('w1', 'viewer', 1)).toBeUndefined()
  })
})
