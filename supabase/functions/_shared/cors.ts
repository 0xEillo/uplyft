export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }
  return null
}

export function jsonResponse(
  body: unknown,
  init: ResponseInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...corsHeaders,
      ...(init.headers instanceof Headers
        ? Object.fromEntries(init.headers.entries())
        : (init.headers as Record<string, string> | undefined)),
    },
  })
}

export function errorResponse(
  status: number,
  message: string,
  details?: unknown,
): Response {
  return jsonResponse(
    details ? { error: message, details } : { error: message },
    { status },
  )
}
