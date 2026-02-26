export function selectNotesToParse({
  notes,
  parserNotes,
  hasStructuredParsed,
}: {
  notes: string
  parserNotes?: string
  hasStructuredParsed: boolean
}): string {
  // Backward-compatibility fallback: if the structured payload failed to parse,
  // parse the raw notes instead of parserNotes so behavior matches older builds.
  if (!hasStructuredParsed && typeof parserNotes === 'string') {
    return notes
  }

  if (typeof parserNotes === 'string') {
    return parserNotes
  }

  return notes
}
