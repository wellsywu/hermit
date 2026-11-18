import { useSyncExternalStore } from 'react'
import { useQuery } from '@tanstack/react-query'
import { APIError, api, getToken, onTokenChange } from '#/api'

export function useToken(): string | null {
  return useSyncExternalStore(onTokenChange, getToken, () => null)
}

/**
 * Who is signed in and whether they are an administrator.
 *
 * `whoami` does not report the admin flag, so it is derived by probing an
 * admin-only endpoint: 403 means a regular user.
 */
export function useSession() {
  const token = useToken()
  const loggedIn = !!token

  const userQuery = useQuery({
    queryKey: ['user'],
    queryFn: () => api.whoami(),
    enabled: loggedIn,
    staleTime: 5 * 60_000,
  })

  const adminQuery = useQuery({
    queryKey: ['is-admin'],
    queryFn: async () => {
      try {
        await api.getDashboardStats()
        return true
      } catch (err) {
        if (err instanceof APIError && err.status === 403) return false
        throw err
      }
    },
    enabled: loggedIn,
    staleTime: 5 * 60_000,
    retry: false,
  })

  return {
    loggedIn,
    user: userQuery.data?.user ?? null,
    isAdmin: adminQuery.data === true,
    isLoading: loggedIn && (userQuery.isLoading || adminQuery.isLoading),
  }
}
