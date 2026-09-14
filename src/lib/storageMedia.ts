import { requireSupabase } from './supabase';
import { logger } from './logger';

const mediaLog = logger('media');

/**
 * Storage buckets backing the Jobs portal. All except `salon-public-media`
 * are private: objects are addressed by STORAGE PATH and rendered through
 * short-lived signed URLs. A signed URL must never be persisted — it expires.
 */
export const MEDIA_BUCKETS = {
  resumes: 'job-resumes',
  certificates: 'job-certificates',
  profileMedia: 'job-profile-media',
  offers: 'job-offers',
  supportAttachments: 'job-support-attachments',
  messageAttachments: 'job-message-attachments',
  employerVerification: 'employer-verification',
  salonPublicMedia: 'salon-public-media',
} as const;

export type MediaBucket = (typeof MEDIA_BUCKETS)[keyof typeof MEDIA_BUCKETS];

/** Product limit for resumes (matches the profile/FAQ copy; the DB allows 10MB). */
export const RESUME_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export const RESUME_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

const randomId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

/** Strips path separators and unusual characters so a filename is safe in a key. */
export function sanitizeFileName(name: string, fallback = 'file'): string {
  const base = name.split(/[\\/]/).pop()?.trim() || fallback;
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 120);
  return cleaned.replace(/^[.-]+/, '') || fallback;
}

const extensionFor = (mimeType: string, fallback: string): string => {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'application/msword') return 'doc';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  return fallback;
};

/* ------------------------------------------------------------------ */
/* Path builders (pure — covered by scripts/test-sprint1.mjs).          */
/* Every private path starts with the owner's user id, which is what    */
/* the storage RLS policies match on.                                   */
/* ------------------------------------------------------------------ */

export function avatarStoragePath(userId: string, mimeType = 'image/jpeg'): string {
  return `${userId}/avatar-${Date.now()}.${extensionFor(mimeType, 'jpg')}`;
}

export function portfolioStoragePath(userId: string, mimeType = 'image/jpeg'): string {
  return `${userId}/portfolio/${randomId()}.${extensionFor(mimeType, 'jpg')}`;
}

export function resumeStoragePath(userId: string, fileName: string): string {
  return `${userId}/${randomId()}-${sanitizeFileName(fileName, 'resume')}`;
}

export function supportAttachmentStoragePath(userId: string, fileName: string): string {
  return `${userId}/${randomId()}-${sanitizeFileName(fileName, 'attachment')}`;
}

export function messageAttachmentStoragePath(userId: string, conversationId: string, fileName: string): string {
  return `${userId}/${conversationId}/${randomId()}-${sanitizeFileName(fileName, 'attachment')}`;
}

/* ------------------------------------------------------------------ */
/* Value-shape guards. `avatar_path`-style columns may hold three kinds */
/* of values during the base64 migration: remote URLs, legacy data      */
/* URLs, and (new) storage paths.                                       */
/* ------------------------------------------------------------------ */

export function isRemoteUrl(value?: string | null): boolean {
  return !!value && /^(https?:|blob:|data:image\/)/.test(value) && !value.startsWith('data:');
}

export function isDataUrl(value?: string | null): value is string {
  return !!value && value.startsWith('data:');
}

export function isStoragePath(value?: string | null): value is string {
  return !!value && !isRemoteUrl(value) && !isDataUrl(value);
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/.exec(dataUrl);
  if (!match) throw new Error('That image is damaged. Please choose the file again.');
  const mimeType = match[1] || 'image/jpeg';
  const base64 = match[3] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export function blobToFile(blob: Blob, fileName: string): File {
  return new File([blob], fileName, { type: blob.type || 'image/jpeg' });
}

/* ------------------------------------------------------------------ */
/* Uploads                                                              */
/* ------------------------------------------------------------------ */

export function assertResumeFile(file: Blob & { name?: string }): asserts file is File {
  const mimeType = file.type;
  if (!(RESUME_MIME_TYPES as readonly string[]).includes(mimeType)) {
    throw new Error('Upload a PDF, DOC or DOCX resume file.');
  }
  if (file.size <= 0) throw new Error('That resume file is empty.');
  if (file.size > RESUME_MAX_BYTES) {
    throw new Error('Resume files must be 5MB or smaller. Export a compressed PDF and try again.');
  }
}

export function assertImageFile(file: Blob, maxBytes = IMAGE_MAX_BYTES): void {
  if (!(IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
    throw new Error('Upload a JPG, PNG or WEBP image.');
  }
  if (file.size <= 0) throw new Error('That image file is empty.');
  if (file.size > maxBytes) {
    throw new Error(`Images must be ${Math.round(maxBytes / 1024 / 1024)}MB or smaller.`);
  }
}

async function uploadObject(bucket: MediaBucket, path: string, file: Blob): Promise<string> {
  const { error } = await requireSupabase().storage.from(bucket).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function uploadAvatar(userId: string, file: Blob): Promise<string> {
  assertImageFile(file);
  return uploadObject(MEDIA_BUCKETS.profileMedia, avatarStoragePath(userId, file.type), file);
}

export async function uploadPortfolioImage(userId: string, file: Blob): Promise<string> {
  assertImageFile(file);
  return uploadObject(MEDIA_BUCKETS.profileMedia, portfolioStoragePath(userId, file.type), file);
}

export async function uploadResumeObject(userId: string, file: File): Promise<string> {
  assertResumeFile(file);
  return uploadObject(MEDIA_BUCKETS.resumes, resumeStoragePath(userId, file.name), file);
}

export async function uploadSupportAttachment(userId: string, file: File): Promise<string> {
  if (file.type === 'application/pdf') {
    if (file.size > IMAGE_MAX_BYTES) throw new Error('Attachments must be 10MB or smaller.');
  } else {
    assertImageFile(file);
  }
  return uploadObject(MEDIA_BUCKETS.supportAttachments, supportAttachmentStoragePath(userId, file.name), file);
}

export async function uploadMessageAttachment(
  userId: string,
  conversationId: string,
  file: File,
): Promise<string> {
  if (file.type === 'application/pdf') {
    if (file.size > IMAGE_MAX_BYTES) throw new Error('Attachments must be 10MB or smaller.');
  } else {
    assertImageFile(file);
  }
  return uploadObject(
    MEDIA_BUCKETS.messageAttachments,
    messageAttachmentStoragePath(userId, conversationId, file.name),
    file,
  );
}

export async function uploadEmployerVerificationDoc(
  userId: string,
  file: File,
  docType = 'business',
): Promise<string> {
  if (file.type === 'application/pdf') {
    if (file.size > IMAGE_MAX_BYTES) throw new Error('Verification documents must be 10MB or smaller.');
  } else {
    assertImageFile(file);
  }
  const path = `${userId}/${docType}-${randomId()}-${sanitizeFileName(file.name, 'doc')}`;
  return uploadObject(MEDIA_BUCKETS.employerVerification, path, file);
}

export async function uploadEmployerLogo(userId: string, file: Blob): Promise<string> {
  assertImageFile(file);
  return uploadObject(MEDIA_BUCKETS.profileMedia, `${userId}/logo-${Date.now()}.${extensionFor(file.type, 'jpg')}`, file);
}

export async function uploadCoverImage(userId: string, file: Blob): Promise<string> {
  assertImageFile(file);
  return uploadObject(MEDIA_BUCKETS.profileMedia, `${userId}/cover-${Date.now()}.${extensionFor(file.type, 'jpg')}`, file);
}

/** Best-effort delete (old avatar after a re-upload, orphaned objects). */
export async function deleteMediaObject(bucket: MediaBucket, path: string): Promise<void> {
  try {
    const { error } = await requireSupabase().storage.from(bucket).remove([path]);
    if (error) mediaLog.warn('storage object delete failed', { bucket });
  } catch (error) {
    mediaLog.warn('storage object delete failed', { bucket, message: (error as Error)?.message });
  }
}

/* ------------------------------------------------------------------ */
/* Reads. Batch-resolves storage paths to signed URLs in ONE request    */
/* per bucket. Unknown/expired entries resolve to null so callers can    */
/* fall back to initials instead of rendering a broken image.           */
/* ------------------------------------------------------------------ */

export async function resolveStorageUrls(
  bucket: MediaBucket,
  paths: Array<string | null | undefined>,
  expiresInSeconds = 86400,
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(isStoragePath))];
  const resolved = new Map<string, string>();
  if (unique.length === 0) return resolved;
  try {
    const { data, error } = await requireSupabase().storage.from(bucket).createSignedUrls(unique, expiresInSeconds);
    if (error) throw error;
    for (const entry of data ?? []) {
      if (entry?.path && entry?.signedUrl) resolved.set(entry.path, entry.signedUrl);
    }
  } catch (error) {
    // Signed-URL resolution is render-only: a failure must degrade to
    // placeholders, never fail the workspace load. Only the bucket travels to
    // the log — paths embed user ids.
    mediaLog.warn('signed url batch failed', { bucket, message: (error as Error)?.message });
  }
  return resolved;
}

/** Resolves a single value that may be a URL, a data URL, or a path. */
export function pickDisplayUrl(
  value: string | null | undefined,
  resolved: Map<string, string>,
): string | undefined {
  if (!value) return undefined;
  if (isRemoteUrl(value) || isDataUrl(value)) return value;
  return resolved.get(value);
}
