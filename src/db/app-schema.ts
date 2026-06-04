import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth-schema.ts'

/**
 * Categories form an arbitrary-depth tree via an adjacency list (`parentId`
 * self-reference). A null parent means it is a top-level category. Deleting a
 * category cascades to its whole subtree (delete-on-delete).
 */
export const category = pgTable(
  'category',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => category.id, {
      onDelete: 'cascade',
    }),
    title: text('title').notNull(),
    description: text('description'),
    photoUrl: text('photo_url'),
    color: text('color'),
    position: integer('position').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('category_owner_idx').on(t.ownerId),
    index('category_parent_idx').on(t.parentId),
  ],
)

export type Category = typeof category.$inferSelect

/**
 * A saved link. Metadata (title/description/image/site) is auto-scraped from the
 * URL's Open Graph tags, but every field is user-editable. `imageUrl` is the
 * thumbnail — there is no separate upload for links (the scraped image is the
 * natural thumbnail; users can edit the URL if it's missing or bad).
 */
export const link = pgTable(
  'link',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    title: text('title'),
    description: text('description'),
    imageUrl: text('image_url'),
    siteName: text('site_name'),
    faviconUrl: text('favicon_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index('link_owner_idx').on(t.ownerId)],
)

export type Link = typeof link.$inferSelect

/**
 * Many-to-many: a link can live in many categories, at any depth. Deleting a
 * link or a category cascades these rows away. (Orphan links — left in zero
 * categories — are hard-deleted in app logic.)
 */
export const linkCategory = pgTable(
  'link_category',
  {
    linkId: uuid('link_id')
      .notNull()
      .references(() => link.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => category.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.linkId, t.categoryId] }),
    index('link_category_category_idx').on(t.categoryId),
  ],
)

/**
 * A public, read-only share of a category and its whole subtree. Any category
 * can be shared (one share per category). Reachable at /s/{slug} by anyone with
 * the link — protection is the unguessable slug (no password).
 */
export const share = pgTable('share', {
  id: uuid('id').primaryKey().defaultRandom(),
  categoryId: uuid('category_id')
    .notNull()
    .unique()
    .references(() => category.id, { onDelete: 'cascade' }),
  ownerId: text('owner_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  slug: text('slug').notNull().unique(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type Share = typeof share.$inferSelect
