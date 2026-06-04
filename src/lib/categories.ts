import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
// Pure type import (fully erased) — keep it separate from the value imports so
// it doesn't anchor the server-only module in the client bundle.
import type { Category } from '#/db/schema.ts'
import { CATEGORY_COLOR_KEYS } from '#/lib/category-colors'
// Server-only values below are referenced ONLY inside handlers, so the TanStack
// plugin strips them (and their node deps, e.g. pg) from the client bundle.
import {
  ancestorIds,
  category,
  db,
  nextPosition,
  ownedCategory,
  purgeOrphanLinks,
  requireUser,
} from '#/lib/server-only.ts'

// ---------- validation (runs on client + server; keep client-safe) ----------

const title = z.string().trim().min(1, 'Title is required').max(120)
const description = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v ? v : null))
const photoUrl = z
  .union([z.url().max(2000), z.literal('')])
  .optional()
  .transform((v) => (v ? v : null))
const color = z
  .string()
  .trim()
  .max(20)
  .optional()
  .transform((v) => (v && CATEGORY_COLOR_KEYS.includes(v) ? v : null))
const id = z.uuid()
const nullableId = z.uuid().nullable()

// ---------- queries ----------

/** Direct children of `parentId` (or top-level when null), for the owner. */
export const listCategories = createServerFn({ method: 'GET' })
  .inputValidator((d: unknown) => z.object({ parentId: nullableId }).parse(d))
  .handler(async ({ data }): Promise<Array<Category>> => {
    const user = await requireUser()
    return db
      .select()
      .from(category)
      .where(
        and(
          eq(category.ownerId, user.id),
          data.parentId === null
            ? isNull(category.parentId)
            : eq(category.parentId, data.parentId),
        ),
      )
      .orderBy(asc(category.position), asc(category.title))
  })

/** Every category the user owns — used to build the move destination picker. */
export const getAllCategories = createServerFn({ method: 'GET' }).handler(
  async (): Promise<
    Array<{ id: string; parentId: string | null; title: string }>
  > => {
    const user = await requireUser()
    return db
      .select({
        id: category.id,
        parentId: category.parentId,
        title: category.title,
      })
      .from(category)
      .where(eq(category.ownerId, user.id))
      .orderBy(asc(category.position), asc(category.title))
  },
)

/** A single category (owner-scoped). */
export const getCategory = createServerFn({ method: 'GET' })
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data }): Promise<Category> => {
    const user = await requireUser()
    return ownedCategory(data.id, user.id)
  })

/** Breadcrumb trail (root → ... → the category itself). */
export const getBreadcrumbs = createServerFn({ method: 'GET' })
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data }): Promise<Array<{ id: string; title: string }>> => {
    const user = await requireUser()
    const result = await db.execute(sql`
        WITH RECURSIVE chain AS (
          SELECT id, parent_id, title, 0 AS depth FROM category
            WHERE id = ${data.id} AND owner_id = ${user.id}
          UNION ALL
          SELECT c.id, c.parent_id, c.title, chain.depth + 1 FROM category c
            JOIN chain ON c.id = chain.parent_id
            WHERE c.owner_id = ${user.id}
        )
        SELECT id, title FROM chain ORDER BY depth DESC
      `)
    return result.rows as Array<{ id: string; title: string }>
  })

// ---------- mutations ----------

export const createCategory = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) =>
    z
      .object({ parentId: nullableId, title, description, photoUrl, color })
      .parse(d),
  )
  .handler(async ({ data }): Promise<Category> => {
    const user = await requireUser()
    if (data.parentId !== null) await ownedCategory(data.parentId, user.id)
    const position = await nextPosition(user.id, data.parentId)
    const [row] = await db
      .insert(category)
      .values({
        ownerId: user.id,
        parentId: data.parentId,
        title: data.title,
        description: data.description,
        photoUrl: data.photoUrl,
        color: data.color,
        position,
      })
      .returning()
    return row
  })

export const updateCategory = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) =>
    z
      .object({ id, title: title.optional(), description, photoUrl, color })
      .parse(d),
  )
  .handler(async ({ data }): Promise<Category> => {
    const user = await requireUser()
    await ownedCategory(data.id, user.id)
    const [row] = await db
      .update(category)
      .set({
        ...(data.title !== undefined ? { title: data.title } : {}),
        description: data.description,
        photoUrl: data.photoUrl,
        color: data.color,
      })
      .where(and(eq(category.id, data.id), eq(category.ownerId, user.id)))
      .returning()
    return row
  })

/** Delete a category and (via FK cascade) its entire subtree. */
export const deleteCategory = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data }): Promise<{ id: string }> => {
    const user = await requireUser()
    await ownedCategory(data.id, user.id)
    await db
      .delete(category)
      .where(and(eq(category.id, data.id), eq(category.ownerId, user.id)))
    // Links left in zero categories after the subtree is gone are hard-deleted.
    await purgeOrphanLinks(user.id)
    return { id: data.id }
  })

/** Move a category under a new parent (or to top level when null). */
export const moveCategory = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) =>
    z.object({ id, newParentId: nullableId }).parse(d),
  )
  .handler(async ({ data }): Promise<Category> => {
    const user = await requireUser()
    await ownedCategory(data.id, user.id)

    if (data.newParentId !== null) {
      if (data.newParentId === data.id) {
        throw new Error('A category cannot be its own parent')
      }
      await ownedCategory(data.newParentId, user.id)
      const targetAncestors = await ancestorIds(data.newParentId, user.id)
      if (targetAncestors.includes(data.id)) {
        throw new Error('Cannot move a category into its own subtree')
      }
    }

    const position = await nextPosition(user.id, data.newParentId)
    const [row] = await db
      .update(category)
      .set({ parentId: data.newParentId, position })
      .where(and(eq(category.id, data.id), eq(category.ownerId, user.id)))
      .returning()
    return row
  })
