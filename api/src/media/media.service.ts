import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectsCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DetectModerationLabelsCommand, RekognitionClient } from '@aws-sdk/client-rekognition';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from './dto/media.dto';
import { publicMediaUrl } from './media-url';

// Rekognition top-level categories that reject an image outright. Tuned for an
// under-16 audience: sponsor logos with alcohol are the likeliest false positive,
// so adjust REKOGNITION_BLOCK if that bites.
const DEFAULT_BLOCK = [
  'Explicit Nudity',
  'Suggestive',
  'Violence',
  'Visually Disturbing',
  'Rude Gestures',
  'Drugs',
  'Tobacco',
  'Alcohol',
  'Gambling',
  'Hate Symbols',
];
const MIN_CONFIDENCE = 75;
const PRESIGN_TTL_SECONDS = 300;

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export type MediaPublic = { id: string; url: string; width: number | null; height: number | null };

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly s3: S3Client;
  private readonly rekognition: RekognitionClient;
  private readonly bucket: string;
  private readonly region: string;
  private readonly blocked: Set<string>;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.region = config.get<string>('AWS_REGION') ?? 'eu-north-1';
    this.bucket = config.get<string>('S3_BUCKET') ?? '';
    this.blocked = new Set(
      (config.get<string>('REKOGNITION_BLOCK') ?? DEFAULT_BLOCK.join(','))
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
    // Credentials come from the standard AWS env vars / instance role.
    this.s3 = new S3Client({ region: this.region });
    this.rekognition = new RekognitionClient({ region: this.region });
    if (!this.bucket) this.logger.warn('S3_BUCKET not set: image uploads disabled');
  }

  get enabled() {
    return !!this.bucket;
  }

  urlFor(key: string) {
    return publicMediaUrl(key);
  }

  toPublic(m: { id: string; key: string; width: number | null; height: number | null }): MediaPublic {
    return { id: m.id, url: this.urlFor(m.key), width: m.width, height: m.height };
  }

  // Step 1: a short-lived URL the app PUTs the file to, and the row that tracks it.
  async presign(ownerId: string, input: { contentType: string; sizeBytes: number; purpose: 'post' | 'avatar'; width?: number; height?: number }) {
    if (!this.enabled) throw new ServiceUnavailableException('media_disabled');
    if (!(IMAGE_TYPES as readonly string[]).includes(input.contentType)) throw new BadRequestException('unsupported_type');
    if (input.sizeBytes > MAX_IMAGE_BYTES) throw new BadRequestException('file_too_large');

    const key = `uploads/${ownerId}/${randomUUID()}.${EXT[input.contentType]}`;
    const row = await this.prisma.media.create({
      data: {
        owner_id: ownerId,
        key,
        content_type: input.contentType,
        purpose: input.purpose,
        size_bytes: input.sizeBytes,
        width: input.width ?? null,
        height: input.height ?? null,
      },
      select: { id: true },
    });

    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: input.contentType }),
      { expiresIn: PRESIGN_TTL_SECONDS },
    );
    return { mediaId: row.id, uploadUrl, url: this.urlFor(key), expiresIn: PRESIGN_TTL_SECONDS };
  }

  // Step 2: after the PUT. Confirms the object exists, scans it, and marks the row.
  // A rejected image is deleted from the bucket straight away; only its labels are kept.
  async complete(ownerId: string, mediaId: string) {
    const row = await this.prisma.media.findUnique({
      where: { id: mediaId },
      select: { id: true, owner_id: true, key: true, status: true, width: true, height: true },
    });
    if (!row || row.owner_id !== ownerId) throw new NotFoundException('media_not_found');
    if (row.status !== 'PENDING') return { status: row.status, media: this.toPublic(row) };

    let size: number | undefined;
    try {
      const head = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: row.key }));
      size = head.ContentLength;
    } catch {
      throw new BadRequestException('upload_not_found');
    }
    if (size !== undefined && size > MAX_IMAGE_BYTES) {
      await this.deleteObjects([row.key]);
      await this.prisma.media.update({ where: { id: row.id }, data: { status: 'REJECTED', moderation_labels: 'too_large' } });
      throw new BadRequestException('file_too_large');
    }

    const labels = await this.scan(row.key);
    const hit = labels.filter((l) => this.blocked.has(l.parent) || this.blocked.has(l.name));
    if (hit.length) {
      await this.deleteObjects([row.key]);
      await this.prisma.media.update({
        where: { id: row.id },
        data: { status: 'REJECTED', moderation_labels: JSON.stringify(hit) },
      });
      return { status: 'REJECTED' as const, media: null };
    }

    const ready = await this.prisma.media.update({
      where: { id: row.id },
      data: { status: 'READY', size_bytes: size ?? undefined, moderation_labels: labels.length ? JSON.stringify(labels) : null },
      select: { id: true, key: true, width: true, height: true },
    });
    return { status: 'READY' as const, media: this.toPublic(ready) };
  }

  // Rekognition moderation labels above the confidence floor, as {name, parent, confidence}.
  private async scan(key: string): Promise<{ name: string; parent: string; confidence: number }[]> {
    try {
      const res = await this.rekognition.send(
        new DetectModerationLabelsCommand({
          Image: { S3Object: { Bucket: this.bucket, Name: key } },
          MinConfidence: MIN_CONFIDENCE,
        }),
      );
      return (res.ModerationLabels ?? []).map((l) => ({
        name: l.Name ?? '',
        parent: l.ParentName || l.Name || '',
        confidence: Math.round(l.Confidence ?? 0),
      }));
    } catch (e: any) {
      // Fail closed: if the scan can't run, the image doesn't go live.
      this.logger.warn(`rekognition failed for ${key}: ${e?.message ?? e}`);
      throw new ServiceUnavailableException('scan_failed');
    }
  }

  // Attach READY, unattached images the user owns to a new post, in the order given.
  async attachToPost(tx: Pick<PrismaService, 'media'>, ownerId: string, postId: string, mediaIds: string[]) {
    const ids = Array.from(new Set(mediaIds));
    const rows = await tx.media.findMany({
      where: { id: { in: ids }, owner_id: ownerId, status: 'READY', post_id: null, purpose: 'post' },
      select: { id: true },
    });
    if (rows.length !== ids.length) throw new BadRequestException('media_not_ready');
    await Promise.all(
      ids.map((id, position) => tx.media.update({ where: { id }, data: { post_id: postId, position } })),
    );
  }

  // A READY avatar upload the user owns, as a public URL.
  async avatarUrl(ownerId: string, mediaId: string) {
    const row = await this.prisma.media.findUnique({
      where: { id: mediaId },
      select: { owner_id: true, key: true, status: true, purpose: true },
    });
    if (!row || row.owner_id !== ownerId || row.status !== 'READY' || row.purpose !== 'avatar') {
      throw new BadRequestException('media_not_ready');
    }
    return this.urlFor(row.key);
  }

  async deleteObjects(keys: string[]) {
    if (!keys.length || !this.enabled) return;
    try {
      await this.s3.send(
        new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true } }),
      );
    } catch (e: any) {
      this.logger.warn(`delete failed: ${e?.message ?? e}`);
    }
  }
}
