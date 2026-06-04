import { authClient } from '#/lib/auth-client.ts'
import { getAuthFeatures, getSession } from '#/lib/auth-server.ts'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  beforeLoad: async ({ search }) => {
    // Already signed in? Skip the login page.
    const session = await getSession()
    if (session?.user) {
      throw redirect({ to: search.redirect || '/app' })
    }
  },
  loader: async () => await getAuthFeatures(),
  component: LoginPage,
})

function LoginPage() {
  const { googleEnabled } = Route.useLoaderData()
  const { redirect: redirectTo } = Route.useSearch()
  const navigate = useNavigate()

  const [isSignUp, setIsSignUp] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const dest = redirectTo || '/app'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = isSignUp
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password })

      if (result.error) {
        setError(
          result.error.message || 'Something went wrong. Please try again.',
        )
        return
      }
      await navigate({ to: dest })
    } catch {
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError('')
    await authClient.signIn.social({ provider: 'google', callbackURL: dest })
  }

  return (
    <main className="page-wrap flex justify-center px-4 pb-16 pt-16">
      <div className="island-shell w-full max-w-md rounded-3xl p-8">
        <div className="mb-6">
          <p className="island-kicker mb-2">Trove</p>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--sea-ink)]">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--sea-ink-soft)]">
            {isSignUp
              ? 'Start cataloguing and sharing your links.'
              : 'Sign in to your collections.'}
          </p>
        </div>

        {googleEnabled && (
          <>
            <button
              type="button"
              onClick={() => void handleGoogle()}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white/60 text-sm font-semibold text-[var(--sea-ink)] transition hover:-translate-y-0.5 hover:bg-white"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
                />
              </svg>
              Continue with Google
            </button>
            <div className="my-5 flex items-center gap-3 text-xs text-[var(--sea-ink-soft)]">
              <span className="h-px flex-1 bg-[var(--line)]" />
              or
              <span className="h-px flex-1 bg-[var(--line)]" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="grid gap-4">
          {isSignUp && (
            <Field label="Name" htmlFor="name">
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="trove-input"
              />
            </Field>
          )}
          <Field label="Email" htmlFor="email">
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="trove-input"
            />
          </Field>
          <Field label="Password" htmlFor="password">
            <input
              id="password"
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="trove-input"
            />
          </Field>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-xl bg-[var(--brand)] text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError('')
            }}
            className="text-sm text-[var(--sea-ink-soft)] transition hover:text-[var(--sea-ink)]"
          >
            {isSignUp
              ? 'Already have an account? Sign in'
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </main>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-[var(--sea-ink)]"
      >
        {label}
      </label>
      {children}
    </div>
  )
}
