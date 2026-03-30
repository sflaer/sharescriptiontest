export const runtime = "edge";

const PASS_HEADERS = [
  "authorization",
  "content-type",
  "accept",
  "accept-language",
] as const;

export default async function handler(req: Request): Promise<Response> {
  const backend = process.env.BACKEND_HTTP_URL?.replace(/\/$/, "");
  if (!backend) {
    return new Response(
      JSON.stringify({
        error:
          "BACKEND_HTTP_URL не задан. В Vercel: Environment Variables → BACKEND_HTTP_URL = http://IP:порт (без / в конце). Очистите VITE_API_URL.",
      }),
      { status: 502, headers: { "content-type": "application/json; charset=utf-8" } },
    );
  }

  const src = new URL(req.url);
  const target = `${backend}${src.pathname}${src.search}`;

  const headers = new Headers();
  for (const name of PASS_HEADERS) {
    const v = req.headers.get(name);
    if (v) headers.set(name, v);
  }

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "manual",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = req.body;
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    return new Response(
      JSON.stringify({ error: "Не удалось связаться с бэкендом" }),
      { status: 502, headers: { "content-type": "application/json; charset=utf-8" } },
    );
  }

  const skip = new Set([
    "connection",
    "content-encoding",
    "content-length",
    "transfer-encoding",
  ]);
  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    if (skip.has(key.toLowerCase())) return;
    out.set(key, value);
  });

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  });
}
