import { useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

/**
 * Bouton retour qui suit l'historique réel de navigation (comme le bouton
 * retour Android). Si aucune page précédente n'existe dans l'app (ouverture
 * directe d'un lien), on retombe sur `fallback`.
 */
export function BackButton({
  fallback = "/client",
  label,
  className = "",
}: {
  fallback?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const navigate = useNavigate();

  function goBack() {
    const canGoBack =
      typeof window !== "undefined" && (router.history.length ?? 1) > 1 && window.history.length > 1;
    if (canGoBack) router.history.back();
    else navigate({ to: fallback });
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Retour"
      className={`inline-flex items-center gap-1.5 rounded-lg p-1 text-sm font-semibold hover:bg-muted ${className}`}
    >
      <ArrowLeft className="h-5 w-5" />
      {label}
    </button>
  );
}
