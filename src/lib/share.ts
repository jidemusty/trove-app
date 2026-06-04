import type { Share } from '#/db/schema'
import { createServerFn } from '@tanstack/react-start'
import { and, asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
// Value imports used ONLY inside handlers -> stripped from the client bundle.
import {
  ancestorIds,
  category,
  db,
  genShareSlug,
  link,
  linkCategory,
  ownedCategory,
  requireUser,
  share,
  sql,
} from '#/lib/server-only'

const id = z.uuid()
const slug = z.string().trim().min(1).max(64)

// ---------- owner management ----------

/** The share for a category, if any (owner-scoped). */
export const getShareForCategory = createServerFn({ method: 'GET' })
  .inputValidator((d: unknown) => z.object({ categoryId: id }).parse(d))
  .handler(async ({ data }): Promise<Share | null> => {
    const user = await requireUser()
    await ownedCategory(data.categoryId, user.id)
    const [row] = await db
      .select()
      .from(share)
      .where(
        and(eq(share.categoryId, data.categoryId), eq(share.ownerId, user.id)),
      )
      .limit(1)
    return row ?? null
  })

/** Start (or re-enable) sharing a category. Idempotent. */
export const createShare = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => z.object({ categoryId: id }).parse(d))
  .handler(async ({ data }): Promise<Share> => {
    const user = await requireUser()
    await ownedCategory(data.categoryId, user.id)

    const [existing] = await db
      .select()
      .from(share)
      .where(eq(share.categoryId, data.categoryId))
      .limit(1)

    if (existing) {
      if (existing.enabled) return existing
      const [updated] = await db
        .update(share)
        .set({ enabled: true })
        .where(eq(share.id, existing.id))
        .returning()
      return updated
    }

    const [created] = await db
      .insert(share)
      .values({
        categoryId: data.categoryId,
        ownerId: user.id,
        slug: genShareSlug(),
      })
      .returning()
    return created
  })

/** Stop sharing — deletes the share so the old link stops working. */
export const deleteShare = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => z.object({ categoryId: id }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const user = await requireUser()
    await db
      .delete(share)
      .where(
        and(eq(share.categoryId, data.categoryId), eq(share.ownerId, user.id)),
      )
    return { ok: true }
  })

// ---------- public read-only view (no auth) ----------

/** Render a shared category (or a descendant of it) for anyone with the slug.
 *  Read-only, owner-scoped to the share owner, confined to the shared subtree. */
export const getSharedView = createServerFn({ method: 'GET' })
  .inputValidator((d: unknown) =>
    z.object({ slug, categoryId: id.optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const [s] = await db
      .select()
      .from(share)
      .where(and(eq(share.slug, data.slug), eq(share.enabled, true)))
      .limit(1)
    if (!s) throw new Error('NOT_FOUND')

    const ownerId = s.ownerId
    const rootId = s.categoryId
    const currentId = data.categoryId ?? rootId

    // Confine navigation to the shared subtree: the shared root must be the
    // current category or one of its ancestors.
    if (currentId !== rootId) {
      const ancestors = await ancestorIds(currentId, ownerId)
      if (!ancestors.includes(rootId)) throw new Error('NOT_FOUND')
    }

    const [current] = await db
      .select()
      .from(category)
      .where(and(eq(category.id, currentId), eq(category.ownerId, ownerId)))
      .limit(1)
    if (!current) throw new Error('NOT_FOUND')

    const subcategories = await db
      .select()
      .from(category)
      .where(
        and(eq(category.ownerId, ownerId), eq(category.parentId, currentId)),
      )
      .orderBy(asc(category.position), asc(category.title))

    const linkRows = await db
      .select()
      .from(linkCategory)
      .innerJoin(link, eq(link.id, linkCategory.linkId))
      .where(
        and(eq(linkCategory.categoryId, currentId), eq(link.ownerId, ownerId)),
      )
      .orderBy(asc(linkCategory.position), desc(link.createdAt))

    // Breadcrumbs from the shared root down to the current category.
    const chain = await db.execute(sql`
      WITH RECURSIVE chain AS (
        SELECT id, parent_id, title, 0 AS depth FROM category
          WHERE id = ${currentId} AND owner_id = ${ownerId}
        UNION ALL
        SELECT c.id, c.parent_id, c.title, chain.depth + 1 FROM category c
          JOIN chain ON c.id = chain.parent_id
          WHERE c.owner_id = ${ownerId}
      )
      SELECT id, title FROM chain ORDER BY depth DESC
    `)
    const full = chain.rows as Array<{ id: string; title: string }>
    const rootIdx = full.findIndex((r) => r.id === rootId)
    const breadcrumbs = rootIdx >= 0 ? full.slice(rootIdx) : full

    return {
      slug: data.slug,
      isRoot: currentId === rootId,
      current: {
        id: current.id,
        title: current.title,
        description: current.description,
        photoUrl: current.photoUrl,
      },
      subcategories,
      links: linkRows.map((r) => r.link),
      breadcrumbs,
    }
  })
