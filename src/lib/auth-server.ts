import { auth, googleEnabled } from '#/lib/auth'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

/**
 * current session (or null) for the incoming request. Safe to call from
 * loaders / beforeload - runs on the server, fetched over RPC on the client.
 */
export const getSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { headers } = getRequest()
    return auth.api.getSession({ headers })
  },
)

/**
 * Which auth features are enabled (so the UI can hide the Google button until
 * credentials are configired
 */
export const getAuthFeatures = createServerFn({ method: 'GET' }).handler(
  async () => ({ googleEnabled }),
)
