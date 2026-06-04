import { Modal } from '#/components/Modal.tsx'
import { createShare, deleteShare, getShareForCategory } from '#/lib/share'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Globe } from 'lucide-react'
import { useState } from 'react'

export function ShareDialog({
  categoryId,
  categoryTitle,
  onClose,
}: {
  categoryId: string
  categoryTitle: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { data: share, isPending } = useQuery({
    queryKey: ['share', categoryId],
    queryFn: () => getShareForCategory({ data: { categoryId } }),
  })
  const [copied, setCopied] = useState(false)
  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['share', categoryId] })

  const create = useMutation({
    mutationFn: () => createShare({ data: { categoryId } }),
    onSuccess: () => invalidate(),
  })
  const remove = useMutation({
    mutationFn: () => deleteShare({ data: { categoryId } }),
    onSuccess: () => invalidate(),
  })

  const shareUrl =
    share?.enabled && typeof window !== 'undefined'
      ? `${window.location.origin}/s/${share.slug}`
      : ''

  return (
    <Modal open onClose={onClose} title={`Share "${categoryTitle}"`}>
      {isPending ? (
        <div className="h-24 animate-pulse rounded-xl bg-[var(--chip-bg)]" />
      ) : share?.enabled ? (
        <div className="grid gap-4">
          <p className="flex items-start gap-2 text-sm text-[var(--sea-ink-soft)]">
            <Globe size={16} className="mt-0.5 flex-shrink-0" />
            Anyone with this link can view this category and everything inside
            it, read-only.
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.target.select()}
              className="trove-input flex-1"
            />
            <button
              onClick={() => {
                void navigator.clipboard?.writeText(shareUrl)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand)] px-4 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            className="justify-self-start text-sm font-medium text-red-600 transition hover:text-red-700 disabled:opacity-50 dark:text-red-400"
          >
            {remove.isPending ? 'Stopping…' : 'Stop sharing'}
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          <p className="text-sm text-[var(--sea-ink-soft)]">
            Create a public, read-only link to this category and everything
            inside it. Only people with the link can open it — there's no
            password, so the link itself is the key.
          </p>
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="justify-self-start rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {create.isPending ? 'Creating…' : 'Create share link'}
          </button>
        </div>
      )}
    </Modal>
  )
}
