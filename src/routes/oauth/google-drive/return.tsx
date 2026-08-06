import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { completeDriveConnect } from "@/lib/api/drive.functions";

export const Route = createFileRoute("/oauth/google-drive/return")({
  component: DriveReturn,
  head: () => ({
    meta: [
      { title: "Connexion Google Drive · ALL IN ONE MADA STORE" },
      { name: "description", content: "Finalisation de la connexion Google Drive du vendeur." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Connexion Google Drive" },
      { property: "og:description", content: "Finalisation de la connexion Google Drive du vendeur." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function DriveReturn() {
  const [message, setMessage] = useState("Finalisation de la connexion…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notify = (type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed") => {
      window.opener?.postMessage({ type, connectorId: "google_drive" }, window.location.origin);
      window.close();
    };
    if (params.get("success") !== "true") {
      setMessage(params.get("error") ?? "La connexion Google n'a pas abouti.");
      notify("appUserConnectorOAuthFailed");
      return;
    }
    const code = params.get("code");
    if (!code) {
      if (params.get("offline_access_allowed") === "false") {
        notify("appUserConnectorOAuthComplete");
        return;
      }
      setMessage("Connexion terminée sans code d'échange.");
      notify("appUserConnectorOAuthFailed");
      return;
    }
    void completeDriveConnect({ data: { code } })
      .then(() => notify("appUserConnectorOAuthComplete"))
      .catch(() => {
        setMessage("Impossible de finaliser la connexion.");
        notify("appUserConnectorOAuthFailed");
      });
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <p className="text-center text-sm text-muted-foreground">{message}</p>
    </main>
  );
}
