// SERVER-ONLY helpers. Never import this from a client component or from the
// top level of a route — only call these *inside* server function handlers.
// Keeping db/auth access out of the server-fn modules' top level prevents
// node-only deps (pg -> "events") from leaking into the client bundle.
import { db } from '#/db'
import { category, link, linkCategory, share } from '#/db/schema.ts'
import { auth } from '#/lib/auth.ts'
import { getRequest } from '@tanstack/react-start/server'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'

/** An unguessable, URL-safe share slug (~16 chars). */
export function genShareSlug(): string {
  return randomBytes(12).toString('base64url')
}

/** Resolve the signed-in user, or throw. */
export async function requireUser() {
  const { headers } = getRequest()
  const session = await auth.api.getSession({ headers })
  if (!session?.user) throw new Error('UNAUTHORIZED')
  return session.user
}

/** Fetch a category owned by the user, or throw. */
export async function ownedCategory(categoryId: string, ownerId: string) {
  const [row] = await db
    .select()
    .from(category)
    .where(and(eq(category.id, categoryId), eq(category.ownerId, ownerId)))
    .limit(1)
  if (!row) throw new Error('NOT_FOUND')
  return row
}

/** Ancestor ids of a category (root → ... → self), owner-scoped. */
export async function ancestorIds(categoryId: string, ownerId: string) {
  const result = await db.execute(sql`
    WITH RECURSIVE chain AS (
      SELECT id, parent_id FROM category
        WHERE id = ${categoryId} AND owner_id = ${ownerId}
      UNION ALL
      SELECT c.id, c.parent_id FROM category c
        JOIN chain ON c.id = chain.parent_id
        WHERE c.owner_id = ${ownerId}
    )
    SELECT id FROM chain
  `)
  return (result.rows as Array<{ id: string }>).map((r) => r.id)
}

/** Next sibling position under a given parent (append to the end). */
export async function nextPosition(ownerId: string, parentId: string | null) {
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${category.position}), -1)` })
    .from(category)
    .where(
      and(
        eq(category.ownerId, ownerId),
        parentId === null
          ? isNull(category.parentId)
          : eq(category.parentId, parentId),
      ),
    )
  return Number(max) + 1
}

/** Fetch a link owned by the user, or throw. */
export async function ownedLink(linkId: string, ownerId: string) {
  const [row] = await db
    .select()
    .from(link)
    .where(and(eq(link.id, linkId), eq(link.ownerId, ownerId)))
    .limit(1)
  if (!row) throw new Error('NOT_FOUND')
  return row
}

/** Hard-delete the owner's links that are left in zero categories
 *  (delete-on-delete). Call after removing category memberships. */
export async function purgeOrphanLinks(ownerId: string) {
  await db.execute(sql`
    DELETE FROM link
    WHERE owner_id = ${ownerId}
      AND NOT EXISTS (
        SELECT 1 FROM link_category lc WHERE lc.link_id = link.id
      )
  `)
}

// Re-export the bits the server fn handlers need, so those modules don't import
// db/drizzle at their own top level (which would leak node deps to the client).
export { and, category, db, eq, isNull, link, linkCategory, share, sql }
