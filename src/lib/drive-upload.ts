import { compressImage, uploadToBucket, logStep } from "@/lib/upload";
import {
  startDriveConnect,
  getDriveStatus,
  disconnectDrive,
  uploadImageToDrive,
} from "@/lib/api/drive.functions";

export type StorageProvider = "supabase" | "drive";

const CONNECTOR_ID = "google_drive";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result ?? "");
      const comma = res.indexOf(",");
      resolve(comma >= 0 ? res.slice(comma + 1) : res);
    };
    reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
    reader.readAsDataURL(file);
  });
}

function waitForOAuthCompletion(popup: Window) {
  return new Promise<void>((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (
        event.origin !== window.location.origin ||
        event.source !== popup ||
        event.data?.connectorId !== CONNECTOR_ID ||
        (type !== "appUserConnectorOAuthComplete" && type !== "appUserConnectorOAuthFailed")
      )
        return;
      cleanup();
      if (type === "appUserConnectorOAuthComplete") return resolve();
      popup.close();
      reject(new Error("La connexion Google Drive a échoué."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("Fenêtre fermée avant la fin de la connexion."));
    }, 500);
  });
}

/** Ouvre la popup OAuth Google Drive pour le vendeur connecté. */
export async function connectGoogleDrive(): Promise<void> {
  const popup = window.open("", "mada-drive-oauth", "width=600,height=720");
  if (!popup) throw new Error("Popup bloquée. Autorisez les fenêtres pop-up puis réessayez.");
  try {
    const { authorizationUrl } = await startDriveConnect();
    const completion = waitForOAuthCompletion(popup);
    popup.location.href = authorizationUrl;
    await completion;
  } catch (e) {
    popup.close();
    throw e;
  }
}

export async function driveStatus() {
  return getDriveStatus();
}

export async function unlinkGoogleDrive() {
  return disconnectDrive();
}

/**
 * Upload d'une image produit vers le stockage choisi.
 * Compression systématique, puis Supabase Storage ou Google Drive du vendeur.
 */
export async function uploadProductImage(
  provider: StorageProvider,
  file: File,
  vendorId: string,
  index: number,
): Promise<string> {
  const compressed = await compressImage(file);
  if (provider === "supabase") {
    const ext = (compressed.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${vendorId}/${Date.now()}-${index}-${Math.random().toString(36).slice(2)}.${ext}`;
    return uploadToBucket("products", path, compressed);
  }
  logStep("upload Google Drive", `${(compressed.size / 1024).toFixed(0)} Ko`);
  const fileBase64 = await fileToBase64(compressed);
  const { url, error } = await uploadImageToDrive({
    data: {
      fileBase64,
      mimeType: compressed.type || "image/jpeg",
      fileName: `${Date.now()}-${index}-${compressed.name}`,
    },
  });
  if (!url) throw new Error(error ?? "Upload Google Drive impossible");
  logStep("upload Drive réussi", url);
  return url;
}

const PROVIDER_KEY = "mada.storage.provider";

export function getStoredProvider(): StorageProvider {
  if (typeof window === "undefined") return "supabase";
  return window.localStorage.getItem(PROVIDER_KEY) === "drive" ? "drive" : "supabase";
}

export function setStoredProvider(p: StorageProvider) {
  if (typeof window !== "undefined") window.localStorage.setItem(PROVIDER_KEY, p);
}
