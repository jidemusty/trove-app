import { colorAccent, colorTint } from '#/lib/category-colors.ts'
import { getSharedView } from '#/lib/share.ts'
import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronRight, Folder, Globe } from 'lucide-react'

export const Route = createFileRoute('/app/s/$slug')({
  validateSearch: (search: Record<string, unknown>) => ({
    c: typeof search.c === 'string' ? search.c : undefined,
  }),
  component: SharedView,
})

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function SharedView() {
  const { slug } = Route.useParams()
  const { c } = Route.useSearch()

  const { data, isPending, isError } = useQuery({
    queryKey: ['shared', slug, c ?? null],
    queryFn: () => getSharedView({ data: { slug, categoryId: c } }),
    retry: false,
  })

  if (isError) {
    return (
      <main className="page-wrap px-4 pb-16 pt-16">
        <div className="island-shell mx-auto max-w-md rounded-3xl p-8 text-center">
          <Globe
            size={36}
            className="mx-auto mb-3 text-[var(--sea-ink-soft)]"
          />
          <h1 className="text-lg font-semibold text-[var(--sea-ink)]">
            This collection isn't available
          </h1>
          <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
            The link may be wrong or the owner stopped sharing it.
          </p>
        </div>
      </main>
    )
  }

  if (isPending || !data) {
    return (
      <main className="page-wrap px-4 pb-16 pt-10">
        <div className="mb-8 h-8 w-48 animate-pulse rounded-lg bg-[var(--chip-bg)]" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="island-shell h-56 animate-pulse rounded-2xl bg-[var(--chip-bg)]"
            />
          ))}
        </div>
      </main>
    )
  }

  const { current, subcategories, links, breadcrumbs } = data
  const empty = subcategories.length === 0 && links.length === 0

  return (
    <main className="page-wrap px-4 pb-16 pt-10">
      {/* Breadcrumbs confined to the shared subtree */}
      <nav className="flex flex-wrap items-center gap-1 text-sm text-[var(--sea-ink-soft)]">
        {breadcrumbs.map((b, i) => {
          const isLast = i === breadcrumbs.length - 1
          return (
            <span key={b.id} className="inline-flex items-center gap-1">
              {i > 0 && <ChevronRight size={14} className="opacity-50" />}
              {isLast ? (
                <span className="max-w-[12rem] truncate px-1.5 py-0.5 font-medium text-[var(--sea-ink)]">
                  {b.title}
                </span>
              ) : (
                <Link
                  to="/s/$slug"
                  params={{ slug }}
                  search={{ c: i === 0 ? undefined : b.id }}
                  className="max-w-[10rem] truncate rounded-md px-1.5 py-0.5 no-underline transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
                >
                  {b.title}
                </Link>
              )}
            </span>
          )
        })}
      </nav>

      <header className="mb-8 mt-4">
        <p className="island-kicker mb-1">Shared collection</p>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--sea-ink)]">
          {current.title}
        </h1>
        {current.description && (
          <p className="mt-2 max-w-2xl text-[var(--sea-ink-soft)]">
            {current.description}
          </p>
        )}
      </header>

      {empty && (
        <div className="island-shell rounded-2xl px-6 py-14 text-center">
          <Folder
            size={36}
            className="mx-auto mb-3 text-[var(--sea-ink-soft)]"
          />
          <p className="text-sm text-[var(--sea-ink-soft)]">
            Nothing here yet.
          </p>
        </div>
      )}

      {subcategories.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">
            Categories
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subcategories.map((cat) => (
              <Link
                key={cat.id}
                to="/s/$slug"
                params={{ slug }}
                search={{ c: cat.id }}
                className="island-shell block overflow-hidden rounded-2xl no-underline transition hover:-translate-y-0.5"
              >
                <div
                  className="flex aspect-[5/2] items-center justify-center overflow-hidden"
                  style={{
                    backgroundColor: colorTint(cat.color) ?? 'var(--chip-bg)',
                  }}
                >
                  {cat.photoUrl ? (
                    <img
                      src={cat.photoUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Folder
                      size={30}
                      style={{ color: colorAccent(cat.color) ?? undefined }}
                      className={
                        colorAccent(cat.color)
                          ? ''
                          : 'text-[var(--sea-ink-soft)]'
                      }
                    />
                  )}
                </div>
                <div className="p-3">
                  <h3 className="truncate font-semibold text-[var(--sea-ink)]">
                    {cat.title}
                  </h3>
                  {cat.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--sea-ink-soft)]">
                      {cat.description}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {links.length > 0 && (
        <section>
          <h2 className="mb-5 text-sm font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">
            Links
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {links.map((l) => (
              <a
                key={l.id}
                href={l.url}
                target="_blank"
                rel="noreferrer noopener"
                className="island-shell block overflow-hidden rounded-2xl no-underline transition hover:-translate-y-0.5"
              >
                <div className="flex aspect-[16/9] items-center justify-center overflow-hidden bg-[var(--chip-bg)]">
                  {l.imageUrl ? (
                    <img
                      src={l.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Globe size={32} className="text-[var(--sea-ink-soft)]" />
                  )}
                </div>
                <div className="p-4">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs text-[var(--sea-ink-soft)]">
                    {l.faviconUrl ? (
                      <img
                        src={l.faviconUrl}
                        alt=""
                        className="h-3.5 w-3.5 rounded-sm"
                      />
                    ) : (
                      <Globe size={13} />
                    )}
                    <span className="truncate">
                      {l.siteName || hostOf(l.url)}
                    </span>
                  </div>
                  <h3 className="line-clamp-2 font-semibold text-[var(--sea-ink)]">
                    {l.title || l.url}
                  </h3>
                  {l.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--sea-ink-soft)]">
                      {l.description}
                    </p>
                  )}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
