import { auth } from '#/lib/auth.ts'
import { putObject, r2Enabled, randomKey } from '#/lib/r2.ts'
import { createFileRoute } from '@tanstack/react-router'

const MAX_BYTES = 5_000_000
const ALLOWED: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

/** Authenticated image upload -> Cloudflare R2. Returns { url }. */
export const Route = createFileRoute('/api/upload')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session?.user) {
          return Response.json({ error: 'Unauthorized.' }, { status: 401 })
        }
        if (!r2Enabled) {
          return Response.json(
            { error: 'Image uploads are not configured.' },
            { status: 503 },
          )
        }

        const form = await request.formData()
        const file = form.get('file')
        if (!(file instanceof File)) {
          return Response.json({ error: 'No file provided.' }, { status: 400 })
        }
        const ext = ALLOWED[file.type]
        if (!ext) {
          return Response.json(
            { error: 'Only PNG, JPEG, WebP, GIF or AVIF images are allowed.' },
            { status: 415 },
          )
        }
        if (file.size > MAX_BYTES) {
          return Response.json(
            { error: 'Image must be 5 MB or smaller.' },
            { status: 413 },
          )
        }

        const bytes = Buffer.from(await file.arrayBuffer())
        const url = await putObject(randomKey('covers', ext), bytes, file.type)
        return Response.json({ url })
      },
    },
  },
})
