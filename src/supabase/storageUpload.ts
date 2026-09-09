import { ensureAdminAuth } from '../auth';
import { supabase, MEDIA_BUCKET } from './config';
import { getSupabaseErrorMessage } from './errors';

const MAX_UPLOAD_MB = 8;
const MAX_COMPRESSED_BYTES = 2 * 1024 * 1024;

export interface UploadOptions {
  folder: string;
  onProgress?: (percent: number) => void;
  maxSizeMb?: number;
}

function inferContentType(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') {
    return file.type;
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  return 'image/jpeg';
}

async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const maxWidth = 1600;
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const qualities = [0.88, 0.8, 0.7, 0.6];
  for (const quality of qualities) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );
    if (blob && blob.size <= MAX_COMPRESSED_BYTES) {
      return blob;
    }
  }

  const fallback = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.5)
  );
  return fallback || file;
}

function slugifyName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60) || 'file'
  );
}

/**
 * Uploads a file directly to Supabase Storage from the browser — no server
 * function needed, so this works on any static host. The `media` bucket is
 * public for reads; writes are restricted to admins by the bucket's storage
 * policies (see supabase/schema.sql).
 */
export async function uploadFile(file: File, options: UploadOptions): Promise<string> {
  const { onProgress, folder, maxSizeMb = MAX_UPLOAD_MB } = options;

  if (file.size > maxSizeMb * 1024 * 1024) {
    throw new Error(`File "${file.name}" exceeds the ${maxSizeMb}MB limit.`);
  }

  onProgress?.(5);

  const isVideo = file.type.startsWith('video/');
  const compressed = isVideo ? file : await compressImage(file);
  const contentType =
    compressed.type && compressed.type !== 'application/octet-stream'
      ? compressed.type
      : inferContentType(file);

  if (!isVideo && compressed.size > MAX_COMPRESSED_BYTES) {
    throw new Error(
      'Image is still too large after compression. Use a smaller photo or paste an image URL.'
    );
  }

  onProgress?.(20);

  // Make sure we're signed in as an admin before attempting the write —
  // storage policies will reject it anyway, but this gives a clearer error.
  await ensureAdminAuth();

  onProgress?.(35);

  const extension = isVideo ? file.name.split('.').pop() || 'mp4' : 'jpg';
  const path = `${folder}/${Date.now()}-${slugifyName(file.name)}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, compressed, { contentType, upsert: false });

  if (uploadError) {
    throw new Error(getSupabaseErrorMessage(uploadError, 'Upload failed.'));
  }

  onProgress?.(90);

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  onProgress?.(100);
  return data.publicUrl;
}

export async function uploadFiles(files: File[], options: UploadOptions): Promise<string[]> {
  const results: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const url = await uploadFile(file, {
      ...options,
      onProgress: options.onProgress
        ? (pct) => options.onProgress!(Math.round(((i + pct / 100) / files.length) * 100))
        : undefined,
    });
    results.push(url);
  }
  return results;
}
