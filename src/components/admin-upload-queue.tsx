import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { createAdminQueueItem, deleteAdminQueueItem } from "@/lib/admin-queue";
import type { QueueItemRow } from "@/lib/upload-queue.server";
import {
  formatBytes,
  formatDuration,
  queueBlobPath,
  titleFromFilename,
  validateCoverFile,
  validateMp3File,
} from "@/lib/upload-queue";

type Props = { initialItems: QueueItemRow[] };

async function mp3DurationSeconds(file: File): Promise<number | null> {
  try {
    const url = URL.createObjectURL(file);
    try {
      return await new Promise<number | null>((resolve) => {
        const audio = new Audio();
        audio.preload = "metadata";
        audio.onloadedmetadata = () =>
          resolve(Number.isFinite(audio.duration) ? audio.duration : null);
        audio.onerror = () => resolve(null);
        audio.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

export function AdminUploadQueue({ initialItems }: Props) {
  const [items, setItems] = useState(initialItems);
  const [mp3, setMp3] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!mp3) return setError("Choose an MP3 first.");
    const mp3Check = validateMp3File({
      filename: mp3.name,
      contentType: mp3.type,
      sizeBytes: mp3.size,
    });
    if (!mp3Check.ok) return setError(mp3Check.error);
    if (cover) {
      const coverCheck = validateCoverFile({
        filename: cover.name,
        contentType: cover.type,
        sizeBytes: cover.size,
      });
      if (!coverCheck.ok) return setError(coverCheck.error);
    }
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      const mp3Path = queueBlobPath("mp3", id, mp3.name);
      if (!mp3Path) throw new Error("Could not build an upload path.");
      const mp3Blob = await upload(mp3Path, mp3, {
        access: "private",
        handleUploadUrl: "/api/admin/blob-upload",
        contentType: "audio/mpeg",
      });
      let coverBlob: { pathname: string; url: string } | null = null;
      if (cover) {
        const coverPath = queueBlobPath("cover", id, cover.type || cover.name);
        if (!coverPath) throw new Error("Cover must be a JPG, PNG or WebP image.");
        coverBlob = await upload(coverPath, cover, {
          access: "private",
          handleUploadUrl: "/api/admin/blob-upload",
          contentType: cover.type || undefined,
        });
      }
      const { item } = await createAdminQueueItem({
        data: {
          id,
          titleOverride: title.trim() || undefined,
          notes: notes.trim() || undefined,
          originalFilename: mp3.name,
          mp3Pathname: mp3Blob.pathname,
          mp3Url: mp3Blob.url,
          mp3SizeBytes: mp3.size,
          coverPathname: coverBlob?.pathname,
          coverUrl: coverBlob?.url,
          coverSizeBytes: cover?.size,
          durationSeconds: await mp3DurationSeconds(mp3),
        },
      });
      setItems((prev) => [item, ...prev]);
      setMp3(null);
      setCover(null);
      setTitle("");
      setNotes("");
      setNotice(`Queued “${item.title}”. It is not on the wall — it waits here for pickup.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(item: QueueItemRow) {
    if (!window.confirm(`Delete “${item.title}” from the queue? This removes its files.`)) return;
    setError(null);
    try {
      const result = await deleteAdminQueueItem({ data: { id: item.id } });
      if (result.deleted) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        if (result.blobErrors.length)
          setNotice("Queue record deleted; a Blob file could not be removed and may be orphaned.");
      } else {
        setError("That item is no longer waiting, so it was not deleted.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  }

  const inputCls =
    "mt-1 w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-fg file:mr-3 file:rounded file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:text-fg";

  return (
    <div className="mt-10 grid gap-10">
      <form onSubmit={onSubmit} className="rounded-lg border border-white/10 p-5">
        <h2 className="font-display text-lg text-fg">Add to the queue</h2>
        <p className="mt-1 text-sm text-muted">
          MP3, optional cover, optional title. Files go to private Blob under{" "}
          <code>queue/</code> — never to the wall, masters or streams.
        </p>
        <label className="mt-5 block text-sm text-fg">
          MP3 (required, max 25 MB)
          <input
            className={inputCls}
            type="file"
            accept=".mp3,audio/mpeg"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setMp3(f);
              if (f && !title) setTitle(titleFromFilename(f.name));
            }}
          />
        </label>
        <label className="mt-4 block text-sm text-fg">
          Cover image (optional, JPG/PNG/WebP, max 10 MB)
          <input
            className={inputCls}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={(e) => setCover(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className="mt-4 block text-sm text-fg">
          Title override (optional)
          <input
            className={inputCls}
            type="text"
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={mp3 ? titleFromFilename(mp3.name) : "From the file name"}
          />
        </label>
        <label className="mt-4 block text-sm text-fg">
          Notes (optional)
          <textarea
            className={inputCls}
            rows={3}
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything the builder should know"
          />
        </label>
        {error ? <p role="alert" className="mt-4 text-sm text-red-300">{error}</p> : null}
        {notice ? <p className="mt-4 text-sm text-emerald-300">{notice}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="mt-5 rounded-md bg-white px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {busy ? "Uploading…" : "Upload to queue"}
        </button>
      </form>

      <section>
        <h2 className="font-display text-lg text-fg">Waiting ({items.length})</h2>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing waiting. Uploads appear here, newest first.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-4 rounded-lg border border-white/10 p-4"
              >
                {item.coverThumbUrl ? (
                  // Private Blob cover via short-lived signed URL (admin only).
                  <img
                    src={item.coverThumbUrl}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded object-cover"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-fg">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {new Date(item.createdAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}{" "}
                    (Europe/London) · {formatDuration(item.durationSeconds)} ·{" "}
                    {formatBytes(item.mp3SizeBytes)} · {item.status}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">{item.originalFilename}</p>
                  {item.notes ? <p className="mt-1 text-sm text-muted">{item.notes}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => void onDelete(item)}
                  className="shrink-0 rounded-md border border-white/15 px-3 py-1.5 text-sm text-fg"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
