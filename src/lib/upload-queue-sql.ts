// Relative import so node --test (strip-types) can load this without the @ alias.
import type { QueueStatus } from "./upload-queue.ts";

/** Insert one queue record. $1..$13 match buildQueueRecord's field order. */
export const INSERT_QUEUE_SQL = `
  insert into upload_queue (
    id, title, original_filename,
    mp3_blob_pathname, mp3_blob_url, mp3_size_bytes,
    cover_blob_pathname, cover_blob_url, cover_size_bytes,
    duration_seconds, notes, status, uploaded_by
  ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
  returning id, title, original_filename as "originalFilename",
    mp3_blob_pathname as "mp3BlobPathname", mp3_blob_url as "mp3BlobUrl",
    mp3_size_bytes as "mp3SizeBytes",
    cover_blob_pathname as "coverBlobPathname", cover_blob_url as "coverBlobUrl",
    cover_size_bytes as "coverSizeBytes",
    duration_seconds as "durationSeconds", notes, status,
    uploaded_by as "uploadedBy", created_at as "createdAt"
`;

/** Queue list for one status, newest first. $1 = status. */
export const LIST_QUEUE_SQL = `
  select id, title, original_filename as "originalFilename",
    mp3_blob_pathname as "mp3BlobPathname", mp3_blob_url as "mp3BlobUrl",
    mp3_size_bytes as "mp3SizeBytes",
    cover_blob_pathname as "coverBlobPathname", cover_blob_url as "coverBlobUrl",
    cover_size_bytes as "coverSizeBytes",
    duration_seconds as "durationSeconds", notes, status,
    uploaded_by as "uploadedBy", created_at as "createdAt"
  from upload_queue
  where status = $1
  order by created_at desc, id desc
  limit 200
`;

export const GET_QUEUE_ITEM_SQL = `
  select id, title, original_filename as "originalFilename",
    mp3_blob_pathname as "mp3BlobPathname", mp3_blob_url as "mp3BlobUrl",
    mp3_size_bytes as "mp3SizeBytes",
    cover_blob_pathname as "coverBlobPathname", cover_blob_url as "coverBlobUrl",
    cover_size_bytes as "coverSizeBytes",
    duration_seconds as "durationSeconds", notes, status,
    uploaded_by as "uploadedBy", created_at as "createdAt"
  from upload_queue where id = $1
`;

/** Phase 1 delete only applies to waiting items; enforced in SQL, not just UI. */
export const DELETE_WAITING_QUEUE_SQL = `
  delete from upload_queue where id = $1 and status = 'waiting'
  returning id, mp3_blob_pathname as "mp3BlobPathname",
    cover_blob_pathname as "coverBlobPathname"
`;

export type QueueStatusFilter = QueueStatus;
