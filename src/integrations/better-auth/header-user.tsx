import { authClient } from '#/lib/auth-client.ts'
import { Link } from '@tanstack/react-router'

export default function BetterAuthHeader() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return (
      <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--chip-bg)]" />
    )
  }

  if (session?.user) {
    const initial =
      session.user.name?.charAt(0).toUpperCase() ||
      session.user.email?.charAt(0).toUpperCase() ||
      'U'
    return (
      <div className="flex items-center gap-2">
        {session.user.image ? (
          <img
            src={session.user.image}
            alt=""
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--chip-bg)] text-xs font-semibold text-[var(--sea-ink)]">
            {initial}
          </div>
        )}
        <button
          onClick={() => {
            void authClient.signOut()
          }}
          className="rounded-full border border-[var(--line)] px-3 py-1.5 text-sm font-semibold text-[var(--sea-ink-soft)] transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <Link
      to="/login"
      search={{ redirect: undefined }}
      className="rounded-full bg-[var(--brand)] px-4 py-1.5 text-sm font-semibold text-white no-underline transition hover:opacity-90"
    >
      Sign in
    </Link>
  )
}
