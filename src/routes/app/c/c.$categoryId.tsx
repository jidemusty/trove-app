import { CategoryView } from '#/components/categories/CategoryView.tsx'
import { ShareDialog } from '#/components/categories/ShareDialog.tsx'
import { LinksSection } from '#/components/links/LinksSection'
import { getBreadcrumbs, getCategory } from '#/lib/categories.ts'
import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronRight, Home, Share2 } from 'lucide-react'
import { useState } from 'react'

export const Route = createFileRoute('/app/c/c/$categoryId')({
  component: FolderView,
})

function FolderView() {
  const { categoryId } = Route.useParams()
  const [sharing, setSharing] = useState(false)

  const category = useQuery({
    queryKey: ['category', categoryId],
    queryFn: () => getCategory({ data: { id: categoryId } }),
    retry: false,
  })
  const crumbs = useQuery({
    queryKey: ['breadcrumbs', categoryId],
    queryFn: () => getBreadcrumbs({ data: { id: categoryId } }),
    retry: false,
  })

  if (category.isError) {
    return (
      <main className="page-wrap px-4 pb-16 pt-10">
        <div className="island-shell rounded-2xl p-8 text-center">
          <h1 className="text-lg font-semibold text-[var(--sea-ink)]">
            Category not found
          </h1>
          <p className="mt-1 text-sm text-[var(--sea-ink-soft)]">
            It may have been deleted.
          </p>
          <Link
            to="/app"
            className="mt-4 inline-block rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white no-underline"
          >
            Back to your Trove
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="page-wrap px-4 pb-16 pt-10">
      <Breadcrumbs trail={crumbs.data ?? []} />

      <header className="mb-8 mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--sea-ink)]">
            {category.data?.title ?? '…'}
          </h1>
          {category.data?.description && (
            <p className="mt-2 max-w-2xl text-[var(--sea-ink-soft)]">
              {category.data.description}
            </p>
          )}
        </div>
        <button
          onClick={() => setSharing(true)}
          className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)]"
        >
          <Share2 size={16} /> Share
        </button>
      </header>

      <CategoryView parentId={categoryId} />
      <LinksSection categoryId={categoryId} />

      {sharing && category.data && (
        <ShareDialog
          categoryId={categoryId}
          categoryTitle={category.data.title}
          onClose={() => setSharing(false)}
        />
      )}
    </main>
  )
}

function Breadcrumbs({
  trail,
}: {
  trail: Array<{ id: string; title: string }>
}) {
  // The last entry is the current category (rendered as plain text).
  const ancestors = trail.slice(0, -1)
  const current = trail[trail.length - 1]

  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-[var(--sea-ink-soft)]">
      <Link
        to="/app"
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 no-underline transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
      >
        <Home size={14} /> Home
      </Link>
      {ancestors.map((c) => (
        <span key={c.id} className="inline-flex items-center gap-1">
          <ChevronRight size={14} className="opacity-50" />
          <Link
            to="/app/c/$categoryId"
            params={{ categoryId: c.id } as any}
            className="max-w-[10rem] truncate rounded-md px-1.5 py-0.5 no-underline transition hover:bg-[var(--link-bg-hover)] hover:text-[var(--sea-ink)]"
          >
            {c.title}
          </Link>
        </span>
      ))}
      {current && (
        <span className="inline-flex items-center gap-1">
          <ChevronRight size={14} className="opacity-50" />
          <span className="max-w-[12rem] truncate px-1.5 py-0.5 font-medium text-[var(--sea-ink)]">
            {current.title}
          </span>
        </span>
      )}
    </nav>
  )
}
