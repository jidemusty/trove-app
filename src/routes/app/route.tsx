import { getSession } from '#/lib/auth-server.ts'
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/app')({
  beforeLoad: async ({ location }) => {
    const session = await getSession()
    if (!session?.user) {
      throw redirect({ to: '/login', search: { redirect: location.pathname } })
    }
    return { user: session.user }
  },
  component: () => <Outlet />,
})
