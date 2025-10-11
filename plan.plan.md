<!-- c21b4a0f-e18a-4671-a1ac-d4e0f5c5ac06 b66afec3-48ae-4a87-8b47-cdac3837f3fd -->
# Data Layer Refactor Plan

## Prep

- Confirm new dependency `@tanstack/react-query` and add QueryClientProvider in `app/_layout.tsx`.
- Extract Supabase client factory into `lib/supabase-client.ts` for shared injection.

## Profile Feature Slice

- Create `features/profile/api.ts` with fetch/update/avatar helpers currently in `lib/database.ts`.
- Add `features/profile/hooks.ts` exposing `useProfileQuery` and mutations (update name, update details, upload avatar).
- Swap `database.profiles.*` usage in `app/settings.tsx` and `app/edit-profile.tsx` to the new hooks, deleting duplicated loaders and save handlers.

## Workouts & Stats Slice

- Extract workout CRUD into `features/workouts/api.ts`; include session create path tuned for batch insertion or RPC.
- Provide React Query hooks for recent workouts and mutations (`useRecentWorkoutsQuery`, `useCreateWorkoutMutation`). Update `app/(tabs)/index.tsx` to consume them.
- Move stats helpers to `features/stats/api.ts` with matching hooks used by charts/components pulling analytics.

## Cleanup & Tests

- Remove now-unused exports from `lib/database.ts`, replacing with thin re-exports or deprecating file entirely.
- Add unit tests for feature APIs (mock supabase client) and integration tests for hooks where practical.
- Verify screens render with cached data, optimistic updates, and no fetch duplication; adjust typings as needed.

### To-dos

- [ ] Introduce React Query dependency and root provider setup
- [ ] Implement profile API/hooks and migrate settings/edit-profile screens
- [ ] Implement workouts/stats APIs/hooks and migrate feed + analytics consumers
- [ ] Retire legacy database module portions and backfill tests