import { createFileRoute, redirect } from '@tanstack/react-router'

// Search lives on the skill list now; keep old /search?q= links working.
export const Route = createFileRoute('/search')({
  validateSearch: (s: Record<string, unknown>) => ({
    q: typeof s.q === 'string' ? s.q : '',
  }),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: '/',
      search: { q: search.q || undefined },
      replace: true,
    })
  },
})
