import { authClient } from '#/lib/auth-client.ts'
import { Link, createFileRoute } from '@tanstack/react-router'
import { FolderTree, Share2, Sparkles } from 'lucide-react'

export const Route = createFileRoute('/app/')({ component: Landing })

function Landing() {
  const { data: session } = authClient.useSession()
  const signedIn = Boolean(session?.user)

  return (
    <main className="page-wrap px-4 pb-20 pt-14 sm:pt-16">
      <section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-12 sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute -left-24 -top-28 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(43,107,79,0.30),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(194,100,63,0.16),transparent_66%)]" />

        <p className="island-kicker mb-3">Catalogue · Organize · Share</p>
        <h1 className="display-title mb-5 max-w-3xl text-4xl font-bold leading-[1.03] tracking-tight text-[var(--sea-ink)] sm:text-6xl">
          Keep every link worth keeping.
        </h1>
        <p className="mb-8 max-w-2xl text-base text-[var(--sea-ink-soft)] sm:text-lg">
          Trove turns scattered links into tidy, shareable collections — nested
          exactly how you think, with rich previews pulled in automatically.
        </p>

        <div className="flex flex-wrap gap-3">
          {signedIn ? (
            <Link
              to="/app"
              className="rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white no-underline transition hover:-translate-y-0.5 hover:opacity-90"
            >
              Open your Trove
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                search={{ redirect: undefined }}
                className="rounded-full bg-[var(--brand)] px-6 py-3 text-sm font-semibold text-white no-underline transition hover:-translate-y-0.5 hover:opacity-90"
              >
                Get started — it's free
              </Link>
              <Link
                to="/login"
                search={{ redirect: undefined }}
                className="rounded-full border border-[rgba(23,58,64,0.2)] bg-white/50 px-6 py-3 text-sm font-semibold text-[var(--sea-ink)] no-underline transition hover:-translate-y-0.5 hover:border-[rgba(23,58,64,0.35)]"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          {
            icon: FolderTree,
            title: 'Nest without limits',
            body: 'Group links into categories and subcategories as deep as you like — Brazil → Places to go → Rio.',
          },
          {
            icon: Sparkles,
            title: 'Rich previews, automatically',
            body: 'Paste a URL and Trove fetches the title, description and image. No manual typing.',
          },
          {
            icon: Share2,
            title: 'Share read-only collections',
            body: 'Share any category with a private link. Friends browse it — no account needed.',
          },
        ].map(({ icon: Icon, title, body }, i) => (
          <article
            key={title}
            className="island-shell feature-card rise-in rounded-2xl p-6"
            style={{ animationDelay: `${i * 90 + 80}ms` }}
          >
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--chip-bg)] text-[var(--lagoon-deep)]">
              <Icon size={20} />
            </div>
            <h2 className="mb-1.5 text-base font-semibold text-[var(--sea-ink)]">
              {title}
            </h2>
            <p className="m-0 text-sm text-[var(--sea-ink-soft)]">{body}</p>
          </article>
        ))}
      </section>
    </main>
  )
}
