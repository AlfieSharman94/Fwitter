// Public URL for an S3 object key. Read lazily from the environment so the post shape
// (a plain module) can build URLs without injection, and so a .env loaded after import
// is still honoured.
export function publicMediaUrl(key: string): string {
  const bucket = process.env.S3_BUCKET ?? '';
  const region = process.env.MEDIA_AWS_REGION ?? process.env.AWS_REGION ?? 'eu-north-1';
  const base = (process.env.MEDIA_PUBLIC_BASE_URL ?? `https://${bucket}.s3.${region}.amazonaws.com`).replace(/\/$/, '');
  return `${base}/${key}`;
}
