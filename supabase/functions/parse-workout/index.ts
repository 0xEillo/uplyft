// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.223.0/http/server.ts'

import { handleRequest } from './handler.ts'

serve(handleRequest)
