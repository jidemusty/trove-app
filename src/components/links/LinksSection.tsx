import { Modal } from '#/components/Modal.tsx'
import type { Link as LinkRow } from '#/db/schema.ts'
import { getAllCategories } from '#/lib/categories.ts'
import {
  createLink,
  deleteLink,
  getLinkCategoryIds,
  listLinks,
  scrapeLink,
  setLinkCategories,
  updateLink,
} from '#/lib/links'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  Copy,
  ExternalLink,
  Globe,
  MoreVertical,
  Pencil,
  Plus,
  Tags,
  Trash2,
} from 'lucide-react'
import { useEffect, useState } from 'react'

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function LinksSection({ categoryId }: { categoryId: string }) {
  const qc = useQueryClient()
  const { data: links, isPending } = useQuery({
    queryKey: ['links', categoryId],
    queryFn: () => listLinks({ data: { categoryId } }),
  })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['links'] })

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<LinkRow | null>(null)
  const [managing, setManaging] = useState<LinkRow | null>(null)
  const [deleting, setDeleting] = useState<LinkRow | null>(null)

  return (
    <section className="mt-12">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">
          Links
        </h2>
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <Plus size={16} /> Add link
        </button>
      </div>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="island-shell h-56 animate-pulse rounded-2xl bg-[var(--chip-bg)]"
            />
          ))}
        </div>
      ) : !links || links.length === 0 ? (
        <div className="island-shell rounded-2xl px-6 py-12 text-center">
          <Globe
            size={34}
            className="mx-auto mb-3 text-[var(--sea-ink-soft)]"
          />
          <p className="text-sm text-[var(--sea-ink-soft)]">
            No links here yet. Paste a URL to add your first one.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((l) => (
            <LinkCard
              key={l.id}
              link={l}
              onEdit={() => setEditing(l)}
              onManage={() => setManaging(l)}
              onDelete={() => setDeleting(l)}
            />
          ))}
        </div>
      )}

      {adding && (
        <AddLinkDialog
          categoryId={categoryId}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            void invalidate()
          }}
        />
      )}
      {editing && (
        <EditLinkDialog
          link={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void invalidate()
          }}
        />
      )}
      {managing && (
        <ManageCategoriesDialog
          link={managing}
          onClose={() => setManaging(null)}
          onSaved={() => {
            setManaging(null)
            void invalidate()
          }}
        />
      )}
      {deleting && (
        <DeleteLinkDialog
          link={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null)
            void invalidate()
          }}
        />
      )}
    </section>
  )
}

function LinkCard({
  link,
  onEdit,
  onManage,
  onDelete,
}: {
  link: LinkRow
  onEdit: () => void
  onManage: () => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])
  return (
    <div className="island-shell relative flex flex-col overflow-hidden rounded-2xl transition hover:-translate-y-0.5">
      <a
        href={link.url}
        target="_blank"
        rel="noreferrer noopener"
        className="block no-underline"
      >
        <div className="flex aspect-[16/9] items-center justify-center overflow-hidden bg-[var(--chip-bg)]">
          {link.imageUrl ? (
            <img
              src={link.imageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <Globe size={32} className="text-[var(--sea-ink-soft)]" />
          )}
        </div>
        <div className="p-4">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs text-[var(--sea-ink-soft)]">
            {link.faviconUrl ? (
              <img
                src={link.faviconUrl}
                alt=""
                className="h-3.5 w-3.5 rounded-sm"
              />
            ) : (
              <Globe size={13} />
            )}
            <span className="truncate">
              {link.siteName || hostOf(link.url)}
            </span>
          </div>
          <h3 className="line-clamp-2 font-semibold text-[var(--sea-ink)]">
            {link.title || link.url}
          </h3>
          {link.description && (
            <p className="mt-1 line-clamp-2 text-sm text-[var(--sea-ink-soft)]">
              {link.description}
            </p>
          )}
        </div>
      </a>

      <div className="absolute right-2 top-2">
        <button
          aria-label="Link actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded-lg bg-[var(--header-bg)]/80 p-1.5 text-[var(--sea-ink)] shadow-sm backdrop-blur transition hover:bg-[var(--header-bg)]"
        >
          <MoreVertical size={18} />
        </button>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--header-bg)] py-1 shadow-lg">
              <MenuItem
                icon={<ExternalLink size={15} />}
                label="Open link"
                onClick={() => {
                  setMenuOpen(false)
                  window.open(link.url, '_blank', 'noopener')
                }}
              />
              <MenuItem
                icon={copied ? <Check size={15} /> : <Copy size={15} />}
                label={copied ? 'Copied!' : 'Copy link'}
                onClick={() => {
                  void navigator.clipboard?.writeText(link.url)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1500)
                }}
              />
              <MenuItem
                icon={<Pencil size={15} />}
                label="Edit"
                onClick={() => {
                  setMenuOpen(false)
                  onEdit()
                }}
              />
              <MenuItem
                icon={<Tags size={15} />}
                label="Categories"
                onClick={() => {
                  setMenuOpen(false)
                  onManage()
                }}
              />
              <MenuItem
                icon={<Trash2 size={15} />}
                label="Delete"
                danger
                onClick={() => {
                  setMenuOpen(false)
                  onDelete()
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition hover:bg-[var(--link-bg-hover)] ${
        danger ? 'text-red-600 dark:text-red-400' : 'text-[var(--sea-ink)]'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function AddLinkDialog({
  categoryId,
  onClose,
  onSaved,
}: {
  categoryId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [siteName, setSiteName] = useState('')
  const [faviconUrl, setFaviconUrl] = useState('')
  const [hasPreview, setHasPreview] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [error, setError] = useState('')

  const scrape = useMutation({
    mutationFn: (u: string) => scrapeLink({ data: { url: u } }),
    onSuccess: (meta) => {
      // Keep the URL the user pasted — never overwrite it with the scrape's
      // final (post-redirect) URL, which can be an anti-bot/error page.
      setTitle(meta.title || '')
      setDescription(meta.description || '')
      setImageUrl(meta.image || '')
      setSiteName(meta.siteName || '')
      setFaviconUrl(meta.favicon || '')
      setHasPreview(true)
      if (!meta.title) setShowDetails(true) // couldn't read it — let them fill
    },
    onError: (e: unknown) => {
      setError(e instanceof Error ? e.message : 'Could not fetch that link.')
      setHasPreview(true)
      setShowDetails(true)
    },
  })

  const save = useMutation({
    mutationFn: () =>
      createLink({
        data: {
          categoryId,
          url: url.trim(),
          title,
          description,
          imageUrl,
          siteName,
          faviconUrl,
        },
      }),
    onSuccess: onSaved,
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : 'Could not save the link.'),
  })

  const onUrlBlur = () => {
    setError('')
    if (url.trim() && !scrape.isPending) scrape.mutate(url.trim())
  }

  return (
    <Modal open onClose={onClose} title="Add link">
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-[var(--sea-ink)]">
            URL
          </label>
          <input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setHasPreview(false)
              setShowDetails(false)
            }}
            onBlur={onUrlBlur}
            autoFocus
            placeholder="Paste a link and tab out"
            className="trove-input"
          />
          {scrape.isPending && (
            <span className="text-xs text-[var(--sea-ink-soft)]">
              Fetching details…
            </span>
          )}
        </div>

        {hasPreview && (
          <div className="flex items-center gap-3 rounded-xl border border-[var(--line)] p-3">
            <div className="flex h-14 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--chip-bg)]">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <Globe size={20} className="text-[var(--sea-ink-soft)]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-[var(--sea-ink)]">
                {title || 'Untitled link'}
              </p>
              <p className="truncate text-xs text-[var(--sea-ink-soft)]">
                {siteName || hostOf(url)}
              </p>
            </div>
          </div>
        )}

        {hasPreview && (
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="justify-self-start text-sm font-medium text-[var(--sea-ink-soft)] underline-offset-2 transition hover:text-[var(--sea-ink)] hover:underline"
          >
            {showDetails ? 'Hide details' : 'Edit details'}
          </button>
        )}

        {showDetails && (
          <>
            <Field label="Title">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="trove-input"
              />
            </Field>
            <Field label="Description">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="trove-input !h-auto py-2"
              />
            </Field>
            <Field label="Image URL">
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="trove-input"
              />
            </Field>
          </>
        )}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-[var(--sea-ink-soft)] transition hover:text-[var(--sea-ink)]"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setError('')
              if (!url.trim()) {
                setError('Please paste a URL.')
                return
              }
              save.mutate()
            }}
            disabled={save.isPending || scrape.isPending}
            className="rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : 'Save link'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function EditLinkDialog({
  link,
  onClose,
  onSaved,
}: {
  link: LinkRow
  onClose: () => void
  onSaved: () => void
}) {
  const [linkUrl, setLinkUrl] = useState(link.url)
  const [title, setTitle] = useState(link.title ?? '')
  const [description, setDescription] = useState(link.description ?? '')
  const [imageUrl, setImageUrl] = useState(link.imageUrl ?? '')
  const [error, setError] = useState('')

  const save = useMutation({
    mutationFn: () =>
      updateLink({
        data: {
          id: link.id,
          url: linkUrl.trim(),
          title,
          description,
          imageUrl,
        },
      }),
    onSuccess: onSaved,
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : 'Could not save.'),
  })

  return (
    <Modal open onClose={onClose} title="Edit link">
      <div className="grid gap-4">
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            className="aspect-[16/9] w-full rounded-xl object-cover"
          />
        )}
        <Field label="URL">
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            className="trove-input"
          />
        </Field>
        <Field label="Title">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="trove-input"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="trove-input !h-auto py-2"
          />
        </Field>
        <Field label="Image URL">
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="trove-input"
          />
        </Field>
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-[var(--sea-ink-soft)] transition hover:text-[var(--sea-ink)]"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setError('')
              save.mutate()
            }}
            disabled={save.isPending}
            className="rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function ManageCategoriesDialog({
  link,
  onClose,
  onSaved,
}: {
  link: LinkRow
  onClose: () => void
  onSaved: () => void
}) {
  const all = useQuery({
    queryKey: ['allCategories'],
    queryFn: () => getAllCategories(),
  })
  const current = useQuery({
    queryKey: ['linkCategories', link.id],
    queryFn: () => getLinkCategoryIds({ data: { linkId: link.id } }),
  })

  const [selected, setSelected] = useState<Set<string> | null>(null)
  const sel = selected ?? new Set(current.data ?? [])
  const [error, setError] = useState('')

  const save = useMutation({
    mutationFn: () =>
      setLinkCategories({
        data: { linkId: link.id, categoryIds: Array.from(sel) },
      }),
    onSuccess: onSaved,
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : 'Could not update.'),
  })

  const toggle = (id: string) => {
    const next = new Set(sel)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const options = buildPaths(all.data ?? [])
  const loading = all.isPending || current.isPending

  return (
    <Modal open onClose={onClose} title="Link categories">
      <div className="grid gap-4">
        <p className="text-sm text-[var(--sea-ink-soft)]">
          Choose every category this link belongs to. Unchecking all will delete
          the link.
        </p>
        {loading ? (
          <div className="h-32 animate-pulse rounded-xl bg-[var(--chip-bg)]" />
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-xl border border-[var(--line)]">
            {options.map((o) => (
              <label
                key={o.id}
                className="flex cursor-pointer items-center gap-2.5 border-b border-[var(--line)] px-3 py-2.5 text-sm text-[var(--sea-ink)] last:border-0 hover:bg-[var(--link-bg-hover)]"
              >
                <input
                  type="checkbox"
                  checked={sel.has(o.id)}
                  onChange={() => toggle(o.id)}
                  className="h-4 w-4 accent-[var(--sea-ink)]"
                />
                <span className="truncate">{o.label}</span>
              </label>
            ))}
          </div>
        )}
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-[var(--sea-ink-soft)] transition hover:text-[var(--sea-ink)]"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setError('')
              save.mutate()
            }}
            disabled={save.isPending || loading}
            className="rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function DeleteLinkDialog({
  link,
  onClose,
  onDeleted,
}: {
  link: LinkRow
  onClose: () => void
  onDeleted: () => void
}) {
  const del = useMutation({
    mutationFn: () => deleteLink({ data: { id: link.id } }),
    onSuccess: onDeleted,
  })
  return (
    <Modal open onClose={onClose} title="Delete link">
      <p className="text-sm text-[var(--sea-ink-soft)]">
        Delete{' '}
        <strong className="text-[var(--sea-ink)]">
          {link.title || hostOf(link.url)}
        </strong>
        ? It will be removed from every category.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-[var(--sea-ink-soft)] transition hover:text-[var(--sea-ink)]"
        >
          Cancel
        </button>
        <button
          onClick={() => del.mutate()}
          disabled={del.isPending}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          {del.isPending ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </Modal>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium text-[var(--sea-ink)]">
        {label}
      </label>
      {children}
    </div>
  )
}

// Full path label ("Brazil / Places / Rio") for every category.
function buildPaths(
  all: Array<{ id: string; parentId: string | null; title: string }>,
) {
  const byId = new Map(all.map((c) => [c.id, c]))
  const path = (c: { id: string; parentId: string | null; title: string }) => {
    const parts: Array<string> = []
    let cur: typeof c | undefined = c
    while (cur) {
      parts.unshift(cur.title)
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    return parts.join(' / ')
  }
  return all
    .map((c) => ({ id: c.id, label: path(c) }))
    .sort((a, b) => a.label.localeCompare(b.label))
}
