const decoder = new TextDecoder()

export async function parseMultipartFormData(
  req: Request,
): Promise<FormData> {
  if (!req.body) {
    throw new Error('Request body is empty')
  }

  const contentType = req.headers.get('content-type') || ''
  if (!contentType.startsWith('multipart/form-data')) {
    throw new Error('Unsupported content type')
  }

  const boundaryMatch = contentType.match(/boundary=([^;]+)/)
  if (!boundaryMatch) {
    throw new Error('Missing multipart boundary')
  }

  const boundary = '--' + boundaryMatch[1]
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }

  const data = concatUint8Arrays(chunks)
  const text = decoder.decode(data)
  const parts = text.split(boundary).slice(1, -1)

  const formData = new FormData()

  for (const part of parts) {
    const trimmedPart = part.trim()
    if (!trimmedPart) continue

    const [rawHeaders, ...bodyLines] = trimmedPart.split(/\r?\n\r?\n/)
    const body = bodyLines.join('\n\n')
    const headers = rawHeaders.split(/\r?\n/)

    const dispositionHeader = headers.find((h) =>
      h.toLowerCase().startsWith('content-disposition'),
    )
    if (!dispositionHeader) continue

    const nameMatch = dispositionHeader.match(/name="([^"]+)"/)
    if (!nameMatch) continue
    const fieldName = nameMatch[1]

    const filenameMatch = dispositionHeader.match(/filename="([^"]+)"/)
    const typeHeader = headers.find((h) =>
      h.toLowerCase().startsWith('content-type'),
    )

    if (filenameMatch) {
      const contentType = typeHeader
        ? typeHeader.split(':')[1].trim()
        : 'application/octet-stream'
      const file = new File([body], filenameMatch[1], {
        type: contentType,
      })
      formData.append(fieldName, file)
    } else {
      formData.append(fieldName, body.trim())
    }
  }

  return formData
}

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const arr of arrays) {
    result.set(arr, offset)
    offset += arr.length
  }
  return result
}
