import nodeFetch, { type RequestInit as NodeRequestInit, type Response } from 'node-fetch'

export function fetch(input: string | URL, init?: NodeRequestInit): Promise<Response> {
  return nodeFetch(input, init)
}
