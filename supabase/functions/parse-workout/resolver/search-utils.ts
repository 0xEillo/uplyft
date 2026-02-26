export interface ResolverCandidate {
  id: string
  name: string
  similarity: number
  aliases?: string[]
}

export interface BatchSearchRpcRow {
  search_query?: string | null
  id: string
  name: string
  aliases?: string[] | null
  best_similarity?: number | null
}

export function rankCandidatesForResolver(
  query: string,
  rows: BatchSearchRpcRow[],
  limit = 10,
): ResolverCandidate[] {
  const queryLower = query.toLowerCase().trim()

  return rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      similarity:
        typeof row.best_similarity === 'number' ? row.best_similarity : 0,
      aliases: Array.isArray(row.aliases) ? row.aliases : [],
    }))
    .sort((a, b) => {
      const aExactName = a.name.toLowerCase() === queryLower
      const bExactName = b.name.toLowerCase() === queryLower
      if (aExactName && !bExactName) return -1
      if (!aExactName && bExactName) return 1

      const aExactAlias = a.aliases?.some(
        (alias: string) => alias.toLowerCase() === queryLower,
      )
      const bExactAlias = b.aliases?.some(
        (alias: string) => alias.toLowerCase() === queryLower,
      )
      if (aExactAlias && !bExactAlias) return -1
      if (!aExactAlias && bExactAlias) return 1

      const diff = (b.similarity ?? 0) - (a.similarity ?? 0)
      if (diff !== 0) return diff

      return a.name.length - b.name.length
    })
    .slice(0, limit)
}

export function buildBatchResolverCandidateMap(
  queries: string[],
  rows: BatchSearchRpcRow[],
  limit = 10,
): Map<string, ResolverCandidate[]> {
  const rowsByQuery = new Map<string, BatchSearchRpcRow[]>()

  for (const row of rows) {
    const searchQuery =
      typeof row.search_query === 'string' ? row.search_query : null
    if (!searchQuery) continue

    const existing = rowsByQuery.get(searchQuery)
    if (existing) {
      existing.push(row)
    } else {
      rowsByQuery.set(searchQuery, [row])
    }
  }

  const result = new Map<string, ResolverCandidate[]>()
  for (const query of queries) {
    result.set(query, rankCandidatesForResolver(query, rowsByQuery.get(query) ?? [], limit))
  }

  return result
}
