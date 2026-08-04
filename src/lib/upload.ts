import { supabase } from "@/integrations/supabase/client";

// ── Robust media upload pipeline ────────────────────────────────────────────
// Cause principale du bug "Failed to fetch" : les images étaient envoyées
// brutes (jusqu'à 15 Mo) depuis un mobile. Sur réseau lent la requête est
// coupée par le navigateur/proxy AVANT toute réponse HTTP → fetch() rejette
// avec "Failed to fetch" (aucun status, donc aucun message utile).
// Correctifs : compression côté client, timeout explicite, retry, session
// vérifiée, logs détaillés et messages d'erreur réels.

const MAX_DIM = 1600;
const JPEG_QUALITY = 0.82;
const TARGET_MAX_BYTES = 1_200_000; // ~1.2 Mo après compression
const UPLOAD_TIMEOUT_MS = 60_000;
const MAX_ATTEMPTS = 3;

export function logStep(step: string, detail?: unknown) {
  // eslint-disable-next-line no-console
  console.info(`[publish] ${step}`, detail ?? "");
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image illisible ou corrompue"));
    };
    img.src = url;
  });
}

/** Redimensionne + compresse une image en JPEG. Renvoie le fichier d'origine en cas d'échec. */
export async function compressImage(file: File): Promise<File> {
  if (typeof document === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= TARGET_MAX_BYTES && file.type === "image/jpeg") return file;
  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    const out = new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
    logStep("image compressée", `${(file.size / 1024).toFixed(0)} Ko → ${(out.size / 1024).toFixed(0)} Ko`);
    return out;
  } catch (e) {
    console.warn("[publish] compression impossible, envoi de l'original", e);
    return file;
  }
}

function humanizeUploadError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg))
    return "Connexion interrompue pendant l'envoi de l'image. Vérifiez votre réseau puis réessayez.";
  if (/aborted|timeout/i.test(msg)) return "L'envoi de l'image a expiré (réseau trop lent).";
  if (/exceeded the maximum allowed size|Payload too large|413/i.test(msg))
    return "Image trop volumineuse pour le serveur.";
  if (/row-level security|Unauthorized|403|new row violates/i.test(msg))
    return "Accès refusé au stockage : votre compte vendeur n'est pas autorisé (ou session expirée).";
  if (/JWT|401|expired/i.test(msg)) return "Session expirée. Reconnectez-vous puis réessayez.";
  return msg || "Erreur inconnue pendant l'envoi";
}

export async function assertSession(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(`Session illisible : ${error.message}`);
  const uid = data.session?.user?.id;
  if (!uid) throw new Error("Session expirée. Reconnectez-vous pour publier.");
  logStep("session vendeur OK", uid);
  return uid;
}

/** Upload avec timeout + retries. Renvoie l'URL publique. */
export async function uploadToBucket(bucket: string, path: string, file: File): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
    try {
      logStep(`début upload (essai ${attempt}/${MAX_ATTEMPTS})`, `${path} · ${(file.size / 1024).toFixed(0)} Ko`);
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        contentType: file.type || "application/octet-stream",
        cacheControl: "3600",
        upsert: false,
        // @ts-expect-error supabase-js transmet les options fetch
        signal: controller.signal,
      });
      if (error) throw error;
      const url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      logStep("upload réussi · URL récupérée", url);
      return url;
    } catch (e) {
      lastErr = e;
      console.error(`[publish] échec upload essai ${attempt}`, e);
      if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 800 * attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(humanizeUploadError(lastErr));
}

export function humanizeDbError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg))
    return "Connexion perdue pendant l'enregistrement du produit. Réessayez.";
  if (/row-level security/i.test(msg))
    return "Publication refusée : votre boutique doit être activée par l'administrateur.";
  return msg || "Erreur inconnue";
}
