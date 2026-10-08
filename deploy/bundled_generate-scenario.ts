// supabase/functions/_shared/common.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// supabase/functions/_shared/core.ts
var HttpError = class extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
};
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var isUuid = (v) => typeof v === "string" && UUID_RE.test(v);
function checkOwnership(story, userId) {
  if (!story || !userId || story.user_id !== userId) {
    throw new HttpError(404, "story_not_found", "Hist\xF3ria n\xE3o encontrada.");
  }
}

// supabase/functions/_shared/common.ts
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
function errorResponse(err) {
  if (err instanceof HttpError) return json({ error: { code: err.code, message: err.message } }, err.status);
  console.error("[edge-function] erro inesperado:", err);
  return json({ error: { code: "internal", message: "Algo deu errado do nosso lado. Tente novamente." } }, 500);
}
async function authenticate(req) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new HttpError(401, "unauthenticated", "Sua sess\xE3o expirou. Entre novamente.");
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data, error } = await userClient.auth.getUser(authHeader.slice("Bearer ".length));
  if (error || !data.user) throw new HttpError(401, "unauthenticated", "Sua sess\xE3o expirou. Entre novamente.");
  const admin = createClient(url, service, { auth: { persistSession: false } });
  return { userId: data.user.id, userClient, admin };
}
async function assertStoryOwner(ctx, storyId) {
  if (!isUuid(storyId)) throw new HttpError(400, "bad_request", "Hist\xF3ria inv\xE1lida.");
  const { data, error } = await ctx.userClient.from("stories").select("*").eq("id", storyId).maybeSingle();
  if (error) throw error;
  checkOwnership(data, ctx.userId);
  return data;
}

// supabase/functions/generate-scenario/index.ts
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const ctx = await authenticate(req);
    const body = await req.json().catch(() => ({}));
    await assertStoryOwner(ctx, body.story_id);
    return json({
      error: { code: "not_available", message: "A gera\xE7\xE3o de imagens por IA chegar\xE1 em breve. Por enquanto, envie uma imagem." }
    }, 501);
  } catch (err) {
    return errorResponse(err);
  }
});
