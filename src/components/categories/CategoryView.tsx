import { Modal } from '#/components/Modal.tsx'
import { ShareDialog } from '#/components/categories/ShareDialog'
import type { Category } from '#/db/schema.ts'
import {
  createCategory,
  deleteCategory,
  getAllCategories,
  listCategories,
  moveCategory,
  updateCategory,
} from '#/lib/categories.ts'
import {
  CATEGORY_COLORS,
  colorAccent,
  colorTint,
} from '#/lib/category-colors.ts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  Ban,
  CornerUpRight,
  Folder,
  ImagePlus,
  MoreVertical,
  Pencil,
  Plus,
  Share2,
  Trash2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export function CategoryView({ parentId }: { parentId: string | null }) {
  const qc = useQueryClient()
  const { data: categories, isPending } = useQuery({
    queryKey: ['categories', parentId],
    queryFn: () => listCategories({ data: { parentId } }),
  })

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['categories'] })
    void qc.invalidateQueries({ queryKey: ['allCategories'] })
  }

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [moving, setMoving] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const [sharing, setSharing] = useState<Category | null>(null)

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--sea-ink-soft)]">
          {parentId ? 'Subcategories' : 'Your categories'}
        </h2>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <Plus size={16} /> New category
        </button>
      </div>

      {isPending ? (
        <GridSkeleton />
      ) : !categories || categories.length === 0 ? (
        <EmptyState
          compact={parentId !== null}
          onCreate={() => setCreating(true)}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <CategoryCard
              key={cat.id}
              category={cat}
              onEdit={() => setEditing(cat)}
              onMove={() => setMoving(cat)}
              onShare={() => setSharing(cat)}
              onDelete={() => setDeleting(cat)}
            />
          ))}
        </div>
      )}

      {creating && (
        <CategoryFormDialog
          title="New category"
          parentId={parentId}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            invalidate()
          }}
        />
      )}
      {editing && (
        <CategoryFormDialog
          title="Edit category"
          category={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            invalidate()
          }}
        />
      )}
      {moving && (
        <MoveDialog
          category={moving}
          onClose={() => setMoving(null)}
          onMoved={() => {
            setMoving(null)
            invalidate()
          }}
        />
      )}
      {deleting && (
        <DeleteDialog
          category={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null)
            invalidate()
          }}
        />
      )}
      {sharing && (
        <ShareDialog
          categoryId={sharing.id}
          categoryTitle={sharing.title}
          onClose={() => setSharing(null)}
        />
      )}
    </div>
  )
}

function CategoryCard({
  category,
  onEdit,
  onMove,
  onShare,
  onDelete,
}: {
  category: Category
  onEdit: () => void
  onMove: () => void
  onShare: () => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const accent = colorAccent(category.color)
  const tint = colorTint(category.color)

  return (
    <div className="island-shell relative overflow-hidden rounded-2xl transition hover:-translate-y-0.5">
      <Link
        to="/app/c/$categoryId"
        params={{ categoryId: category.id } as any}
        className="block no-underline"
      >
        <div
          className="flex aspect-[5/2] items-center justify-center overflow-hidden"
          style={{ backgroundColor: tint ?? 'var(--chip-bg)' }}
        >
          {category.photoUrl ? (
            <img
              src={category.photoUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <Folder
              size={30}
              style={accent ? { color: accent } : undefined}
              className={accent ? '' : 'text-[var(--sea-ink-soft)]'}
            />
          )}
        </div>
        <div className="p-3">
          <h3 className="truncate text-sm font-semibold text-[var(--sea-ink)] sm:text-base">
            {category.title}
          </h3>
          {category.description && (
            <p className="mt-1 line-clamp-2 text-sm text-[var(--sea-ink-soft)]">
              {category.description}
            </p>
          )}
        </div>
      </Link>

      <div className="absolute right-2 top-2">
        <button
          aria-label="Category actions"
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
            <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--header-bg)] py-1 shadow-lg">
              <MenuItem
                icon={<Pencil size={15} />}
                label="Edit"
                onClick={() => {
                  setMenuOpen(false)
                  onEdit()
                }}
              />
              <MenuItem
                icon={<CornerUpRight size={15} />}
                label="Move"
                onClick={() => {
                  setMenuOpen(false)
                  onMove()
                }}
              />
              <MenuItem
                icon={<Share2 size={15} />}
                label="Share"
                onClick={() => {
                  setMenuOpen(false)
                  onShare()
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

function CategoryFormDialog({
  title,
  category,
  parentId,
  onClose,
  onSaved,
}: {
  title: string
  category?: Category
  parentId?: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [titleValue, setTitleValue] = useState(category?.title ?? '')
  const [description, setDescription] = useState(category?.description ?? '')
  const [photoUrl, setPhotoUrl] = useState(category?.photoUrl ?? '')
  const [color, setColor] = useState<string | null>(category?.color ?? null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed.')
      setPhotoUrl(data.url)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (category) {
        return updateCategory({
          data: {
            id: category.id,
            title: titleValue,
            description,
            photoUrl,
            color: color ?? undefined,
          },
        })
      }
      return createCategory({
        data: {
          parentId: parentId ?? null,
          title: titleValue,
          description,
          photoUrl,
          color: color ?? undefined,
        },
      })
    },
    onSuccess: onSaved,
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : 'Something went wrong'),
  })

  return (
    <Modal open onClose={onClose} title={title}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          setError('')
          mutation.mutate()
        }}
      >
        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-[var(--sea-ink)]">
            Title
          </label>
          <input
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            required
            maxLength={120}
            autoFocus
            className="trove-input"
            placeholder="e.g. Brazil"
          />
        </div>
        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-[var(--sea-ink)]">
            Description{' '}
            <span className="text-[var(--sea-ink-soft)]">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            rows={3}
            className="trove-input !h-auto py-2"
            placeholder="What's this collection about?"
          />
        </div>
        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-[var(--sea-ink)]">
            Cover image{' '}
            <span className="text-[var(--sea-ink-soft)]">(optional)</span>
          </label>
          {photoUrl && (
            <img
              src={photoUrl}
              alt=""
              className="aspect-[16/9] w-full rounded-xl object-cover"
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] px-3 py-2 text-sm font-semibold text-[var(--sea-ink)] transition hover:bg-[var(--link-bg-hover)] disabled:opacity-50"
            >
              <ImagePlus size={15} />{' '}
              {uploading ? 'Uploading…' : 'Upload image'}
            </button>
            {photoUrl && (
              <button
                type="button"
                onClick={() => setPhotoUrl('')}
                className="text-sm font-medium text-[var(--sea-ink-soft)] transition hover:text-[var(--sea-ink)]"
              >
                Remove
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
            className="hidden"
            onChange={handleFile}
          />
          <input
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            type="url"
            className="trove-input"
            placeholder="…or paste an image URL"
          />
          {uploadError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {uploadError}
            </p>
          )}
        </div>

        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-[var(--sea-ink)]">
            Color <span className="text-[var(--sea-ink-soft)]">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setColor(null)}
              aria-label="No color"
              title="No color"
              className={`flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] text-[var(--sea-ink-soft)] transition ${color === null ? 'ring-2 ring-[var(--sea-ink)] ring-offset-2 ring-offset-[var(--surface-strong)]' : ''}`}
            >
              <Ban size={14} />
            </button>
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setColor(c.key)}
                aria-label={c.label}
                title={c.label}
                style={{ backgroundColor: c.accent }}
                className={`h-8 w-8 rounded-full transition ${color === c.key ? 'ring-2 ring-[var(--sea-ink)] ring-offset-2 ring-offset-[var(--surface-strong)]' : ''}`}
              />
            ))}
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="mt-1 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-[var(--sea-ink-soft)] transition hover:text-[var(--sea-ink)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function MoveDialog({
  category,
  onClose,
  onMoved,
}: {
  category: Category
  onClose: () => void
  onMoved: () => void
}) {
  const { data: all } = useQuery({
    queryKey: ['allCategories'],
    queryFn: () => getAllCategories(),
  })
  const [target, setTarget] = useState<string>('') // '' = top level
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      moveCategory({
        data: { id: category.id, newParentId: target === '' ? null : target },
      }),
    onSuccess: onMoved,
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : 'Move failed'),
  })

  // Exclude the category itself and its descendants as destinations.
  const options = buildMoveOptions(all ?? [], category.id)

  return (
    <Modal open onClose={onClose} title={`Move "${category.title}"`}>
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <label className="text-sm font-medium text-[var(--sea-ink)]">
            Move into
          </label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="trove-input"
          >
            <option value="">— Top level —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
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
              mutation.mutate()
            }}
            disabled={mutation.isPending}
            className="rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {mutation.isPending ? 'Moving…' : 'Move here'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function DeleteDialog({
  category,
  onClose,
  onDeleted,
}: {
  category: Category
  onClose: () => void
  onDeleted: () => void
}) {
  const mutation = useMutation({
    mutationFn: () => deleteCategory({ data: { id: category.id } }),
    onSuccess: onDeleted,
  })
  return (
    <Modal open onClose={onClose} title="Delete category">
      <p className="text-sm text-[var(--sea-ink-soft)]">
        Delete{' '}
        <strong className="text-[var(--sea-ink)]">{category.title}</strong> and
        everything inside it? This also removes all of its subcategories. This
        can't be undone.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-[var(--sea-ink-soft)] transition hover:text-[var(--sea-ink)]"
        >
          Cancel
        </button>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </Modal>
  )
}

// Build labelled move destinations (full path), excluding the moving category
// and its whole subtree.
function buildMoveOptions(
  all: Array<{ id: string; parentId: string | null; title: string }>,
  movingId: string,
) {
  const byId = new Map(all.map((c) => [c.id, c]))
  const excluded = new Set<string>([movingId])
  // Mark descendants of movingId as excluded.
  let changed = true
  while (changed) {
    changed = false
    for (const c of all) {
      if (c.parentId && excluded.has(c.parentId) && !excluded.has(c.id)) {
        excluded.add(c.id)
        changed = true
      }
    }
  }
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
    .filter((c) => !excluded.has(c.id))
    .map((c) => ({ id: c.id, label: path(c) }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

function EmptyState({
  compact,
  onCreate,
}: {
  compact: boolean
  onCreate: () => void
}) {
  if (compact) {
    return (
      <button
        onClick={onCreate}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[var(--line)] px-5 py-6 text-sm text-[var(--sea-ink-soft)] transition hover:border-[var(--chip-line)] hover:text-[var(--sea-ink)]"
      >
        <Plus size={15} /> Add a subcategory
      </button>
    )
  }
  return (
    <div className="island-shell flex flex-col items-center rounded-2xl px-6 py-14 text-center">
      <Folder size={40} className="mb-3 text-[var(--sea-ink-soft)]" />
      <h3 className="font-semibold text-[var(--sea-ink)]">No categories yet</h3>
      <p className="mt-1 max-w-xs text-sm text-[var(--sea-ink-soft)]">
        Categories organise your links. Create one to get started.
      </p>
      <button
        onClick={onCreate}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
      >
        <Plus size={16} /> New category
      </button>
    </div>
  )
}

function GridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="island-shell h-56 animate-pulse rounded-2xl bg-[var(--chip-bg)]"
        />
      ))}
    </div>
  )
}
