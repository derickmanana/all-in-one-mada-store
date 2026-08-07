import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Démarre la connexion Google Drive du vendeur (popup OAuth). */
export const startDriveConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientAPIKey = process.env['GOOGLE_DRIVE_APP_USER_CONNECTOR_CLIENT_API_KEY'];
    if (!clientAPIKey) throw new Error("Google Drive n'est pas configuré pour ce projet.");
    const request = getRequest();
    if (!request) throw new Error("OAuth doit démarrer depuis une requête de l'application.");
    const returnUrl = new URL("/oauth/google-drive/return", request.url).toString();

    const { authorizeAppUserOAuth } = await import("@/integrations/lovable/appUserConnector");
    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const existing = await getConnectionKeyForUser(context.userId, "google_drive");

    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: "https://connector-gateway.lovable.dev",
      connectorId: "google_drive",
      appUserId: context.userId,
      clientAPIKey,
      returnUrl,
      connectionAPIKey: existing ?? undefined,
      credentialsConfiguration: {
        scopes: [
          "https://www.googleapis.com/auth/userinfo.email",
          "https://www.googleapis.com/auth/userinfo.profile",
          "https://www.googleapis.com/auth/drive.file",
        ],
      },
    });
    return { authorizationUrl };
  });

/** Termine la connexion : échange le code à usage unique et stocke la clé chiffrée. */
export const completeDriveConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ code: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { exchangeAppUserOAuthCode } = await import("@/integrations/lovable/appUserConnector");
    const { saveConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(
      "https://connector-gateway.lovable.dev",
      data.code,
    );
    if (connectorId !== "google_drive") throw new Error("Mauvais connecteur renvoyé par OAuth.");
    await saveConnectionKeyForUser(context.userId, connectorId, connectionAPIKey);
    return { ok: true };
  });

/** Statut de connexion Drive du vendeur (+ email du compte Google si dispo). */
export const getDriveStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const connectionAPIKey = await getConnectionKeyForUser(context.userId, "google_drive");
    if (!connectionAPIKey) return { connected: false, email: null as string | null };
    try {
      const { callAsAppUser } = await import("@/integrations/lovable/appUserConnector");
      const res = await callAsAppUser({
        gatewayBaseUrl: "https://connector-gateway.lovable.dev",
        connectionAPIKey,
        connectorId: "google_drive",
        path: "/drive/v3/about?fields=user(emailAddress)",
      });
      if (!res.ok) {
        console.error("drive about failed", res.status, await res.text());
        return { connected: false, email: null };
      }
      const json: any = await res.json();
      return { connected: true, email: json?.user?.emailAddress ?? null };
    } catch (e) {
      console.error("drive status error", e);
      return { connected: false, email: null };
    }
  });

/** Déconnecte Google Drive pour ce vendeur. */
export const disconnectDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getConnectionKeyForUser, deleteConnectionForUser } = await import(
      "@/server/appUserConnections.server"
    );
    const connectionAPIKey = await getConnectionKeyForUser(context.userId, "google_drive");
    if (connectionAPIKey) {
      const { disconnectAppUser } = await import("@/integrations/lovable/appUserConnector");
      try {
        await disconnectAppUser({
          gatewayBaseUrl: "https://connector-gateway.lovable.dev",
          connectionAPIKey,
          connectorId: "google_drive",
        });
      } catch (e) {
        console.error("drive disconnect gateway error", e);
      }
    }
    await deleteConnectionForUser(context.userId, "google_drive");
    return { ok: true };
  });

/** Upload d'une image produit dans le Drive du vendeur → renvoie une URL image directe. */
export const uploadImageToDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z.object({
      fileBase64: z.string().min(20).max(20_000_000),
      mimeType: z.string().default("image/jpeg"),
      fileName: z.string().min(1).max(180).default("produit.jpg"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { getConnectionKeyForUser } = await import("@/server/appUserConnections.server");
    const connectionAPIKey = await getConnectionKeyForUser(context.userId, "google_drive");
    if (!connectionAPIKey) {
      return { url: null as string | null, error: "Google Drive non connecté pour ce compte." };
    }
    const { callAsAppUser } = await import("@/integrations/lovable/appUserConnector");

    const call = (path: string, init?: RequestInit) =>
      callAsAppUser({
        gatewayBaseUrl: "https://connector-gateway.lovable.dev",
        connectionAPIKey,
        connectorId: "google_drive",
        path,
        init,
      });

    async function findOrCreateFolder(name: string, parent?: string): Promise<string> {
      const q = [
        `name='${name.replace(/'/g, "\\'")}'`,
        "mimeType='application/vnd.google-apps.folder'",
        "trashed=false",
        parent ? `'${parent}' in parents` : "'root' in parents",
      ].join(" and ");
      const list = await call(`/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1`);
      if (list.ok) {
        const j: any = await list.json();
        if (j?.files?.[0]?.id) return j.files[0].id as string;
      } else {
        console.error("drive folder list failed", list.status, await list.text());
      }
      const created = await call("/drive/v3/files?fields=id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          mimeType: "application/vnd.google-apps.folder",
          parents: parent ? [parent] : undefined,
        }),
      });
      if (!created.ok) throw new Error(`Création du dossier "${name}" échouée: ${await created.text()}`);
      const cj: any = await created.json();
      return cj.id as string;
    }

    try {
      const root = await findOrCreateFolder("ALL IN ONE MADA STORE");
      const folder = await findOrCreateFolder("Produits", root);

      const bytes = Buffer.from(data.fileBase64, "base64");
      const boundary = `mada${Math.random().toString(36).slice(2)}${Date.now()}`;
      const meta = JSON.stringify({ name: data.fileName, parents: [folder] });
      const body = new Blob([
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${data.mimeType}\r\n\r\n`,
        bytes,
        `\r\n--${boundary}--\r\n`,
      ]);

      const up = await call("/upload/drive/v3/files?uploadType=multipart&fields=id", {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body,
      });
      if (!up.ok) {
        const t = await up.text();
        console.error("drive upload failed", up.status, t);
        return { url: null, error: `Upload Google Drive refusé (${up.status})` };
      }
      const uj: any = await up.json();
      const fileId: string = uj.id;

      const perm = await call(`/drive/v3/files/${fileId}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "reader", type: "anyone" }),
      });
      if (!perm.ok) {
        console.error("drive permission failed", perm.status, await perm.text());
        return { url: null, error: "Impossible de rendre l'image lisible publiquement." };
      }

      // URL image directe (CDN Google) : aucun lien "drive.google.com" visible côté client.
      return { url: `https://lh3.googleusercontent.com/d/${fileId}=w1600`, error: null };
    } catch (e) {
      console.error("drive upload error", e);
      return { url: null, error: e instanceof Error ? e.message : "Erreur Google Drive" };
    }
  });
