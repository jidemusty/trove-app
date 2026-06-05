import { createServerFn } from '@tanstack/react-start'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
// Pure type imports (erased) kept separate from value imports so they don't
// anchor server-only modules in the client bundle.
import type { Link } from '#/db/schema.ts'
import type { ScrapedMetadata } from '#/lib/scrape-server.ts'
// Value imports below are used ONLY inside handlers -> stripped from client.

import {
  deleteObject,
  keyFromPublicUrl,
  putObject,
  r2Enabled,
  randomKey,
} from '#/lib/r2'
import { fetchImageBytes, scrapeUrl } from '#/lib/scrape-server.ts'
import {
  category,
  db,
  link,
  linkCategory,
  ownedCategory,
  ownedLink,
  requireUser,
} from '#/lib/server-only'

// ---------- validation ----------

const url = z.string().trim().min(1, 'URL is required').max(2000)
const id = z.uuid()
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null))
const optionalUrl = z
  .union([z.url().max(2000), z.literal('')])
  .optional()
  .transform((v) => (v ? v : null))

// ---------- scrape (preview before saving) ----------

export const scrapeLink = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => z.object({ url }).parse(d))
  .handler(async ({ data }): Promise<ScrapedMetadata> => {
    await requireUser()
    return scrapeUrl(data.url)
  })

// ---------- queries ----------

/** Links in a category (owner-scoped). */
export const listLinks = createServerFn({ method: 'GET' })
  .inputValidator((d: unknown) => z.object({ categoryId: id }).parse(d))
  .handler(async ({ data }): Promise<Array<Link>> => {
    const user = await requireUser()
    const rows = await db
      .select()
      .from(linkCategory)
      .innerJoin(link, eq(link.id, linkCategory.linkId))
      .where(
        and(
          eq(linkCategory.categoryId, data.categoryId),
          eq(link.ownerId, user.id),
        ),
      )
      .orderBy(asc(linkCategory.position), desc(link.createdAt))
    return rows.map((r) => r.link)
  })

/** Category ids a link currently belongs to (for the membership editor). */
export const getLinkCategoryIds = createServerFn({ method: 'GET' })
  .inputValidator((d: unknown) => z.object({ linkId: id }).parse(d))
  .handler(async ({ data }): Promise<Array<string>> => {
    const user = await requireUser()
    await ownedLink(data.linkId, user.id)
    const rows = await db
      .select({ categoryId: linkCategory.categoryId })
      .from(linkCategory)
      .where(eq(linkCategory.linkId, data.linkId))
    return rows.map((r) => r.categoryId)
  })

// ---------- mutations ----------

export const createLink = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) =>
    z
      .object({
        categoryId: id,
        url,
        title: optionalText(300),
        description: optionalText(2000),
        imageUrl: optionalUrl,
        siteName: optionalText(120),
        faviconUrl: optionalUrl,
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<Link> => {
    const user = await requireUser()
    await ownedCategory(data.categoryId, user.id)

    // Cache the preview image into R2 (best-effort; falls back to the remote URL).
    let imageUrl = data.imageUrl
    if (r2Enabled && imageUrl) {
      const img = await fetchImageBytes(imageUrl)
      if (img) {
        try {
          imageUrl = await putObject(
            randomKey('links', img.ext),
            img.bytes,
            img.contentType,
          )
        } catch {
          // keep the remote URL on failure
        }
      }
    }

    const [row] = await db
      .insert(link)
      .values({
        ownerId: user.id,
        url: data.url,
        title: data.title,
        description: data.description,
        imageUrl,
        siteName: data.siteName,
        faviconUrl: data.faviconUrl,
      })
      .returning()

    const [{ max }] = await db
      .select({ max: sql<number>`coalesce(max(${linkCategory.position}), -1)` })
      .from(linkCategory)
      .where(eq(linkCategory.categoryId, data.categoryId))

    await db.insert(linkCategory).values({
      linkId: row.id,
      categoryId: data.categoryId,
      position: Number(max) + 1,
    })
    return row
  })

export const updateLink = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) =>
    z
      .object({
        id,
        url: url.optional(),
        title: optionalText(300),
        description: optionalText(2000),
        imageUrl: optionalUrl,
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<Link> => {
    const user = await requireUser()
    await ownedLink(data.id, user.id)
    const [row] = await db
      .update(link)
      .set({
        ...(data.url ? { url: data.url } : {}),
        title: data.title,
        description: data.description,
        imageUrl: data.imageUrl,
      })
      .where(and(eq(link.id, data.id), eq(link.ownerId, user.id)))
      .returning()
    return row
  })

/** Delete a link entirely (cascade removes its category memberships). */
export const deleteLink = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => z.object({ id }).parse(d))
  .handler(async ({ data }): Promise<{ id: string }> => {
    const user = await requireUser()
    const row = await ownedLink(data.id, user.id)
    await db
      .delete(link)
      .where(and(eq(link.id, data.id), eq(link.ownerId, user.id)))
    // Best-effort: remove the cached image from R2 if we own it.
    const key = row.imageUrl ? keyFromPublicUrl(row.imageUrl) : null
    if (key) await deleteObject(key).catch(() => {})
    return { id: data.id }
  })

/** Replace the set of categories a link belongs to. Empty set deletes the
 *  link (a link in zero categories is hard-deleted). */
export const setLinkCategories = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) =>
    z.object({ linkId: id, categoryIds: z.array(id) }).parse(d),
  )
  .handler(async ({ data }): Promise<{ deleted: boolean }> => {
    const user = await requireUser()
    await ownedLink(data.linkId, user.id)

    const unique = Array.from(new Set(data.categoryIds))
    if (unique.length === 0) {
      await db
        .delete(link)
        .where(and(eq(link.id, data.linkId), eq(link.ownerId, user.id)))
      return { deleted: true }
    }

    // Ensure every target category belongs to the user.
    const owned = await db
      .select({ id: category.id })
      .from(category)
      .where(and(eq(category.ownerId, user.id), inArray(category.id, unique)))
    if (owned.length !== unique.length) {
      throw new Error('One or more categories are invalid.')
    }

    await db.delete(linkCategory).where(eq(linkCategory.linkId, data.linkId))
    await db.insert(linkCategory).values(
      unique.map((categoryId, i) => ({
        linkId: data.linkId,
        categoryId,
        position: i,
      })),
    )
    return { deleted: false }
  })
