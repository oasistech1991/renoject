import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type MediaRow = {
  id: string;
  property_id: string;
  storage_path: string;
  kind: "image" | "pdf";
  filename: string | null;
  is_hero: boolean;
  sort_order: number;
  created_at: string;
};

type SignedRow = MediaRow & { signedUrl: string | null };

const BUCKET = "property-media";

async function uploadImage(propertyId: string, blob: Blob, filename: string) {
  const safe = filename.replace(/[^a-z0-9._-]+/gi, "_");
  const path = `${propertyId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type || "image/png", upsert: false });
  if (upErr) throw upErr;
  const { error: insErr } = await supabase.from("property_media").insert({
    property_id: propertyId,
    storage_path: path,
    kind: "image",
    filename,
    is_hero: false,
    sort_order: 0,
  } as any);
  if (insErr) throw insErr;
}

async function renderPdfPagesToImages(file: File): Promise<Blob[]> {
  // Load pdf.js from a CDN at runtime so the bundler never touches it
  // (avoids SSR module-resolution failures with the worker ?url import).
  const PDFJS_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.min.mjs";
  const WORKER_URL = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs";
  const pdfjs: any = await import(/* @vite-ignore */ PDFJS_URL);
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER_URL;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const out: Blob[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), "image/png"),
    );
    if (blob) out.push(blob);
  }
  await doc.destroy();
  return out;
}

export function PropertyMedia({ propertyId }: { propertyId: string }) {
  const [items, setItems] = useState<SignedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("property_media")
      .select("*")
      .eq("property_id", propertyId)
      .order("is_hero", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const rows = (data as MediaRow[]) ?? [];
    const signed = await Promise.all(
      rows.map(async (r) => {
        const { data: s } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(r.storage_path, 60 * 60);
        return { ...r, signedUrl: s?.signedUrl ?? null };
      })
    );
    setItems(signed);
    setLoading(false);
  };

  useEffect(() => {
    if (propertyId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  const onPick = () => fileRef.current?.click();

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of files) {
        const isPdf =
          file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
        const isImage = file.type.startsWith("image/");
        if (!isPdf && !isImage) {
          setError(`Skipped ${file.name}: only images or PDFs are allowed.`);
          continue;
        }
        if (file.size > 25 * 1024 * 1024) {
          setError(`Skipped ${file.name}: max 25 MB.`);
          continue;
        }
        if (isPdf) {
          // Rasterise every page of the PDF into a PNG and upload as image only.
          // Text and other PDF data are intentionally discarded.
          const blobs = await renderPdfPagesToImages(file);
          if (blobs.length === 0) {
            setError(`No pages found in ${file.name}.`);
            continue;
          }
          const baseName = file.name.replace(/\.pdf$/i, "");
          for (let i = 0; i < blobs.length; i++) {
            const pageBlob = blobs[i];
            const filename = `${baseName} — page ${i + 1}.png`;
            await uploadImage(propertyId, pageBlob, filename);
          }
        } else {
          await uploadImage(propertyId, file, file.name);
        }
      }
      await load();
    } catch (err: any) {
      setError(err?.message ?? "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const setHero = async (id: string) => {
    // clear any other hero first, then set this one
    await supabase
      .from("property_media")
      .update({ is_hero: false } as any)
      .eq("property_id", propertyId);
    const { error } = await supabase
      .from("property_media")
      .update({ is_hero: true } as any)
      .eq("id", id);
    if (error) setError(error.message);
    await load();
  };

  const remove = async (row: SignedRow) => {
    if (!confirm(`Delete ${row.filename ?? "this file"}?`)) return;
    await supabase.storage.from(BUCKET).remove([row.storage_path]);
    const { error } = await supabase.from("property_media").delete().eq("id", row.id);
    if (error) setError(error.message);
    await load();
  };

  const hero = items.find((i) => i.is_hero && i.kind === "image");
  const gallery = items.filter((i) => i.id !== hero?.id);

  return (
    <section className="space-y-4">
      {hero?.signedUrl && (
        <div className="overflow-hidden rounded-xl border border-border">
          <div
            className="h-56 w-full bg-cover bg-center sm:h-72"
            style={{ backgroundImage: `url(${hero.signedUrl})` }}
            aria-label={hero.filename ?? "Hero banner"}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Gallery & attachments</h2>
          <p className="text-xs text-muted-foreground">
            Upload images or a PDF — every PDF page is added to the gallery as an image. Mark one image as the hero banner.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,application/pdf,.pdf"
            className="hidden"
            onChange={onFiles}
          />
          <Button size="sm" variant="outline" onClick={onPick} disabled={uploading}>
            {uploading ? "Uploading…" : "Upload images / PDF"}
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {loading && <p className="text-xs text-muted-foreground">Loading media…</p>}

      {!loading && items.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          No media yet — upload photos of the property or attach the deal PDF.
        </div>
      )}

      {gallery.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {gallery.map((m) => (
            <div key={m.id} className="group relative overflow-hidden rounded-lg border border-border bg-card">
              {m.kind === "image" && m.signedUrl ? (
                <div
                  className="aspect-video w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${m.signedUrl})` }}
                />
              ) : (
                <a
                  href={m.signedUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex aspect-video w-full items-center justify-center bg-muted text-xs text-muted-foreground"
                >
                  📄 {m.filename ?? "PDF"}
                </a>
              )}
              <div className="flex items-center justify-between gap-1 border-t border-border p-2">
                <span className="truncate text-[10px] text-muted-foreground" title={m.filename ?? ""}>
                  {m.filename ?? m.kind.toUpperCase()}
                </span>
                <div className="flex shrink-0 gap-1">
                  {m.kind === "image" && (
                    <button
                      type="button"
                      onClick={() => setHero(m.id)}
                      className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-accent"
                      title="Set as hero banner"
                    >
                      Hero
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(m)}
                    className="rounded border border-border px-1.5 py-0.5 text-[10px] hover:bg-destructive/10 hover:text-destructive"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}