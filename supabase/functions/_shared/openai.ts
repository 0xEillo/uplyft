import OpenAI from 'https://esm.sh/openai@4.55.3'

let client: OpenAI | null = null

export function getOpenAI(): OpenAI {
  if (!client) {
    const apiKey = Deno.env.get('OPENAI_API_KEY')
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY env')
    client = new OpenAI({ apiKey })
  }
  return client
}
