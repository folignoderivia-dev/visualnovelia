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
function parseJson(text) {
  const cleaned = (text ?? "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
      }
    }
    throw new HttpError(502, "ai_bad_format", "O narrador respondeu de forma inesperada. Tente novamente.");
  }
}
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

// supabase/functions/_shared/gemini.ts
var MODEL = () => Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash-lite";
var TIMEOUT_MS = 5e4;
async function callGemini(opts) {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new HttpError(503, "ai_not_configured", "A IA ainda n\xE3o foi configurada neste projeto.");
  const model = MODEL();
  const body = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.9,
      maxOutputTokens: opts.maxOutputTokens ?? 3072,
      ...opts.schema ? { responseMimeType: "application/json", responseSchema: opts.schema } : {}
    }
  };
  const delays = [2e3, 4e3, 0];
  let attempts = 0;
  while (attempts < 3) {
    attempts++;
    let res;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
    } catch (e) {
      console.error(`[gemini] falha de rede/timeout (tentativa ${attempts})`, e);
      if (e?.name === "TimeoutError") throw new HttpError(504, "ai_timeout", "O narrador demorou demais para responder. Tente novamente.");
      throw new HttpError(503, "ai_unavailable", "O narrador est\xE1 indispon\xEDvel no momento. Tente novamente em instantes.");
    }
    if (res.status === 503) {
      console.warn(`[gemini] 503 recebido. Tentativa ${attempts} falhou.`);
      if (attempts < 3) {
        await new Promise((r) => setTimeout(r, delays[attempts - 1]));
        continue;
      }
    }
    if (!res.ok) {
      console.error("[gemini] erro", res.status, (await res.text()).slice(0, 500));
      if (res.status === 429) throw new HttpError(429, "ai_rate_limit", "O narrador est\xE1 sobrecarregado. Aguarde alguns segundos.");
      if (res.status === 400 || res.status === 403) throw new HttpError(503, "ai_config_error", "A chave da IA parece inv\xE1lida ou sem permiss\xE3o. Verifique a configura\xE7\xE3o.");
      throw new HttpError(503, "ai_unavailable", "O narrador est\xE1 indispon\xEDvel no momento. Tente novamente em instantes.");
    }
    const data = await res.json();
    const cand = data?.candidates?.[0];
    const text = cand?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (data?.promptFeedback?.blockReason || cand?.finishReason === "SAFETY") {
      throw new HttpError(422, "ai_blocked", "O narrador n\xE3o p\xF4de continuar com essa a\xE7\xE3o. Tente reformular.");
    }
    if (cand?.finishReason === "MAX_TOKENS") {
      console.error("[gemini] resposta truncada (MAX_TOKENS)");
      throw new HttpError(502, "ai_bad_format", "O narrador respondeu de forma incompleta. Tente novamente.");
    }
    if (!text.trim()) {
      console.error("[gemini] resposta vazia", JSON.stringify(data).slice(0, 500));
      throw new HttpError(502, "ai_empty", "O narrador n\xE3o respondeu. Tente reformular sua a\xE7\xE3o.");
    }
    return text;
  }
  throw new HttpError(503, "ai_unavailable", "O narrador est\xE1 indispon\xEDvel no momento (tentativas excedidas).");
}

// supabase/functions/extract-story-memory/index.ts
var TYPES = ["world", "character", "relationship", "event", "fact", "player", "plot", "scene", "preference"];
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const ctx = await authenticate(req);
    const body = await req.json().catch(() => ({}));
    const story = await assertStoryOwner(ctx, body.story_id);
    const { data: msgs } = await ctx.admin.from("story_messages").select("sender_type,content").eq("story_id", story.id).order("sequence_number", { ascending: false }).limit(15);
    if (!msgs?.length) return json({ saved: 0 });
    const transcript = msgs.reverse().map((m) => `${m.sender_type}: ${m.content}`).join("\n");
    const out = parseJson(
      await callGemini({
        system: "Extraia apenas fatos duradouros e importantes de uma hist\xF3ria (revela\xE7\xF5es, promessas, mudan\xE7as de rela\xE7\xE3o). Portugu\xEAs do Brasil. Se nada for importante, devolva lista vazia.",
        prompt: transcript,
        temperature: 0.2,
        maxOutputTokens: 800,
        schema: {
          type: "OBJECT",
          properties: { memories: { type: "ARRAY", items: {
            type: "OBJECT",
            properties: {
              memory_type: { type: "STRING", enum: TYPES },
              content: { type: "STRING" },
              importance: { type: "INTEGER" }
            },
            required: ["memory_type", "content"]
          } } },
          required: ["memories"]
        }
      })
    );
    const rows = (out.memories ?? []).slice(0, 5).filter((m) => m.content?.length > 7).map((m) => ({
      story_id: story.id,
      memory_type: TYPES.includes(m.memory_type) ? m.memory_type : "event",
      content: m.content.slice(0, 500),
      importance: Math.min(5, Math.max(1, Number.isInteger(m.importance) ? m.importance : 3))
    }));
    if (rows.length) await ctx.admin.from("story_memories").insert(rows);
    return json({ saved: rows.length });
  } catch (err) {
    return errorResponse(err);
  }
});
