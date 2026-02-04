import type { WorkoutSong } from '@/types/music'

const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search'

interface ItunesSearchResponse {
  results: Array<{
    trackId: number
    trackName: string
    artistName: string
    previewUrl: string
    artworkUrl100: string
    trackViewUrl: string
    trackTimeMillis?: number
    kind?: string
  }>
}

export async function searchItunesSongs(
  query: string,
  { limit = 12, country = 'US' }: { limit?: number; country?: string } = {},
): Promise<WorkoutSong[]> {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    return []
  }

  const params = new URLSearchParams({
    term: trimmedQuery,
    entity: 'song',
    media: 'music',
    limit: String(limit),
    country,
  })

  try {
    const response = await fetch(`${ITUNES_SEARCH_URL}?${params.toString()}`)
    if (!response.ok) {
      return []
    }

    const data = (await response.json()) as ItunesSearchResponse
    if (!Array.isArray(data.results)) {
      return []
    }

    return data.results
      .filter((result) => result.previewUrl && result.kind === 'song')
      .map((result) => ({
        trackId: result.trackId,
        trackName: result.trackName,
        artistName: result.artistName,
        artworkUrl100: result.artworkUrl100,
        previewUrl: result.previewUrl,
        trackViewUrl: result.trackViewUrl,
        trackTimeMillis: result.trackTimeMillis,
      }))
  } catch (error) {
    console.error('Error fetching iTunes songs:', error)
    return []
  }
}
