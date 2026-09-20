import { supabase } from "@/integrations/supabase/client";
import { docVersion } from "@/lib/legal";

export async function recordAcceptances(userId: string, keys: string[]) {
  const rows = keys.map((k) => ({
    user_id: userId,
    doc_key: k,
    version: docVersion(k),
  }));
  const { error } = await supabase.from("legal_acceptances").insert(rows);
  if (error) console.error("legal acceptance", error.message);
}

export async function hasAccepted(userId: string, key: string): Promise<boolean> {
  const { data } = await supabase
    .from("legal_acceptances")
    .select("version")
    .eq("user_id", userId)
    .eq("doc_key", key)
    .eq("version", docVersion(key))
    .limit(1);
  return !!data && data.length > 0;
}

export async function listAcceptances(userId: string) {
  const { data } = await supabase
    .from("legal_acceptances")
    .select("doc_key, version, accepted_at")
    .eq("user_id", userId)
    .order("accepted_at", { ascending: false });
  return data ?? [];
}
