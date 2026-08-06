import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  imageBase64: z.string().min(20).max(8_000_000),
  mimeType: z.string().default("image/jpeg"),
  currentTitle: z.string().max(200).default(""),
  categories: z.array(z.object({ id: z.string(), name: z.string() })).max(60).default([]),
});

export type ProductAISuggestion = {
  title: string;
  description: string;
  category_id: string | null;
  category_name: string | null;
  colors: string[];
  sizes: string[];
  units: string[];
};

/** Analyse IA d'une image produit : titre, description, catégorie, attributs. */
export const analyzeProductWithAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => Input.parse(i))
  .handler(async ({ data }) => {
    const apiKey = process.env['LOVABLE_API_KEY'];
    if (!apiKey) return { suggestion: null as ProductAISuggestion | null, error: "IA non configurée" };

    const catList = data.categories.map((c) => `${c.id} = ${c.name}`).join("\n");
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "Tu es expert e-commerce à Madagascar. À partir d'une image produit et d'un titre brut, tu proposes une fiche produit optimisée en français. " +
                "Le titre fait entre 15 et 30 caractères. La description fait entre 60 et 360 caractères, professionnelle, sans invention de prix. " +
                "Tu choisis la catégorie la plus adaptée UNIQUEMENT dans la liste fournie (renvoie son id exact). " +
                "Tu proposes les couleurs visibles, les tailles/pointures plausibles et les unités pertinentes (unité, pièce, paire, kg, g, L, mL, m, m², m³, cm, pouce, Ah, W, V).",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Titre saisi par le vendeur: "${data.currentTitle}".\nCatégories disponibles:\n${catList}`,
                },
                {
                  type: "image_url",
                  image_url: { url: `data:${data.mimeType};base64,${data.imageBase64}` },
                },
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "product_suggestion",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  category_id: { type: "string" },
                  category_name: { type: "string" },
                  colors: { type: "array", items: { type: "string" } },
                  sizes: { type: "array", items: { type: "string" } },
                  units: { type: "array", items: { type: "string" } },
                },
                required: [
                  "title",
                  "description",
                  "category_id",
                  "category_name",
                  "colors",
                  "sizes",
                  "units",
                ],
              },
            },
          },
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        console.error("product AI error", res.status, t);
        return {
          suggestion: null,
          error: res.status === 429 ? "Trop de requêtes IA, réessayez." : "Erreur IA",
        };
      }
      const json: any = await res.json();
      const raw = json?.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as ProductAISuggestion;
      const valid = data.categories.some((c) => c.id === parsed.category_id);
      return {
        suggestion: { ...parsed, category_id: valid ? parsed.category_id : null },
        error: null,
      };
    } catch (e) {
      console.error("product AI failed", e);
      return { suggestion: null, error: "Analyse impossible (réseau)" };
    }
  });
