# 🪺 Trove

Catalogue and share your links. Trove turns scattered links into tidy,
shareable collections — nested exactly how you think, with rich previews pulled
in automatically.

Built end-to-end in TypeScript on **TanStack Start**, with **Postgres**,
**Better Auth**, and **Cloudflare R2**.

---

rdo

## Features

- **Auth** — email/password + Google OAuth (Better Auth). Everything is owner-scoped.
- **Categories** — an arbitrary-depth tree (e.g. `Brazil → Places to go → Rio`),
  navigated folder-style with breadcrumbs; create, edit, move, delete.
- **Links** — add by URL with **automatic Open Graph previews** (title,
  description, image, site). A link can live in **many** categories at once.
- **Rich previews** — server-side scraper, **SSRF-hardened**; scraped images are
  **cached to R2** for reliability (with a paste-your-own-URL fallback).
- **Images** — upload custom **category covers** to R2, or paste a URL.
- **Sharing** — make any category a **public, read-only** collection at
  `/s/{slug}`; the view is confined to that subtree. No account needed to view.
- **Modern UI** — mobile-first, light + dark, "Pine & Clay" palette.

## Tech stack

| Layer      | Choice                                                                |
| ---------- | --------------------------------------------------------------------- |
| Framework  | TanStack Start (React 19, Router, Query) — full-stack, one deployable |
| Language   | TypeScript, front to back                                             |
| Database   | Postgres + Drizzle ORM                                                |
| Auth       | Better Auth (email/password + Google)                                 |
| Storage    | Cloudflare R2 (S3-compatible) for images                              |
| Validation | Zod                                                                   |
| Styling    | Tailwind CSS v4 + shadcn primitives, lucide icons                     |
