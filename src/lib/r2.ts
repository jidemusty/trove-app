// SERVER-ONLY. Cloudflare R2 (S3-compatible) object storage client + helpers.
// Import only from server function handlers / API routes — never a client
// component (it pulls in the AWS SDK + node crypto).
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { randomBytes } from 'node:crypto'

const accountId = process.env.R2_ACCOUNT_ID
const accessKeyId = process.env.R2_ACCESS_KEY_ID
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
const bucket = process.env.R2_BUCKET
const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, '')

/** True only when every R2 env var is present — features gate on this so the
 *  app runs fine without R2 configured. */
export const r2Enabled = Boolean(
  accountId && accessKeyId && secretAccessKey && bucket && publicBase,
)

const client = r2Enabled
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId as string,
        secretAccessKey: secretAccessKey as string,
      },
    })
  : null

/** Public URL for a stored object key. */
export function publicUrlFor(key: string): string {
  return `${publicBase}/${key}`
}

/** A random object key like "covers/3f9a…webp". */
export function randomKey(prefix: string, ext: string): string {
  const clean = ext.replace(/^\./, '')
  return `${prefix}/${randomBytes(16).toString('hex')}${clean ? `.${clean}` : ''}`
}

/** Upload bytes and return the public URL. */
export async function putObject(
  key: string,
  body: Uint8Array | Buffer,
  contentType: string,
): Promise<string> {
  if (!client) throw new Error('R2 is not configured.')
  await client.send(
    new PutObjectCommand({
      Bucket: bucket as string,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  )
  return publicUrlFor(key)
}

/** Delete an object by key (best-effort; ignores if R2 is off). */
export async function deleteObject(key: string): Promise<void> {
  if (!client) return
  await client.send(
    new DeleteObjectCommand({ Bucket: bucket as string, Key: key }),
  )
}

/** Extract the object key from a public R2 URL we generated (for cleanup). */
export function keyFromPublicUrl(url: string): string | null {
  if (!publicBase || !url.startsWith(`${publicBase}/`)) return null
  return url.slice(publicBase.length + 1)
}
