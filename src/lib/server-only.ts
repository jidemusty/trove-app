// SERVER-ONLY helpers. Never import this from a client component or from the
// top level of a route — only call these *inside* server function handlers.
// Keeping db/auth access out of the server-fn modules' top level prevents
// node-only deps (pg -> "events") from leaking into the client bundle.

import { auth } from '#/lib/auth.ts'
import { getRequest } from '@tanstack/react-start/server'

/** Resolve the signed-in user, or throw. */
export async function requireUser() {
  const { headers } = getRequest()
  const session = await auth.api.getSession({ headers })
  if (!session?.user) throw new Error('UNAUTHORIZED')
  return session.user
}
