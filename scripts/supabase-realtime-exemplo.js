// Exemplo opcional para uso direto no navegador.
// Use somente a chave pública/publishable. Nunca exponha SUPABASE_SECRET_KEY.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function acompanharConteudosSupabase({ url, publishableKey, aoMudar }) {
  const supabase = createClient(url, publishableKey);
  const canal = supabase
    .channel("conteudos-painel-ao-vivo")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "conteudos_painel" },
      (evento) => aoMudar?.(evento)
    )
    .subscribe();

  return () => supabase.removeChannel(canal);
}
