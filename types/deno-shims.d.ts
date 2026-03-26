declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
}

declare module 'https://esm.sh/@supabase/supabase-js@2.58.0' {
  export function createClient<TSchema = any>(...args: any[]): any
}
