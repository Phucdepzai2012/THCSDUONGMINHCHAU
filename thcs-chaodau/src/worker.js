// =========================================================
// Cloudflare Worker - Cổng thông tin Trường THCS Chao Đâu
// Backend: D1 Database + R2 Storage
// Không dùng thư viện ngoài; chỉ dùng Web APIs của Workers.
// =========================================================

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization"
};

function withCors(response) {
  const headers = new Headers(response.headers);
  Object.entries(CORS).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      ...CORS
    }
  });
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeBase64Text(value) {
  return bytesToBase64(new TextEncoder().encode(value));
}

function decodeBase64Text(value) {
  return new TextDecoder().decode(base64ToBytes(value));
}

async function sign(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Date.now();
  const body = { ...payload, exp: now + 86400000 };
  const encodedHeader = encodeBase64Text(JSON.stringify(header));
  const encodedPayload = encodeBase64Text(JSON.stringify(body));
  const data = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );

  return `${data}.${bytesToBase64(new Uint8Array(signature))}`;
}

async function verify(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = JSON.parse(decodeBase64Text(encodedHeader));
    const payload = JSON.parse(decodeBase64Text(encodedPayload));

    if (header?.alg !== "HS256" || header?.typ !== "JWT") return null;
    if (!payload?.exp || Date.now() >= Number(payload.exp)) return null;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64ToBytes(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    );

    return valid ? payload : null;
  } catch {
    return null;
  }
}

async function requireAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token) return null;
  return verify(token, env.JWT_SECRET || "doi_thanh_chuoi_bi_mat_that_dai_va_kho_doan_1234567890");
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function getId(path, prefix) {
  return decodeURIComponent(path.slice(prefix.length));
}

function sanitizeFolder(value) {
  const folder = String(value || "misc")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .replace(/\.\./g, "");
  return folder || "misc";
}

function getExtension(fileName) {
  const name = String(fileName || "").trim();
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "bin";
  const ext = name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]+/g, "");
  return ext || "bin";
}

async function handleAPI(request, env, path, method) {
  // AUTH
  if (path === "/api/login" && method === "POST") {
    const body = await readJson(request);
    const username = String(body?.username ?? "");
    const password = String(body?.password ?? "");
    const adminUser = env.ADMIN_USER || "admin";
    const adminPass = env.ADMIN_PASS || "admin123";

    if (username !== adminUser || password !== adminPass) {
      return json({ error: "Sai tên đăng nhập hoặc mật khẩu" }, 401);
    }

    const token = await sign({ user: username }, env.JWT_SECRET || "doi_thanh_chuoi_bi_mat_that_dai_va_kho_doan_1234567890");
    return json({ token });
  }

  if (path === "/api/logout" && method === "POST") {
    return json({ ok: true });
  }

  // POSTS
  if (path === "/api/posts" && method === "GET") {
    const result = await env.DB.prepare(
      "SELECT * FROM posts ORDER BY date DESC, created_at DESC"
    ).all();
    return json(result.results || []);
  }

  if (path === "/api/posts" && method === "POST") {
    const user = await requireAuth(request, env);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await readJson(request);
    if (!body?.title || !body?.cat || !body?.date || !body?.excerpt) {
      return json({ error: "Thiếu title, cat, date hoặc excerpt" }, 400);
    }

    const id = crypto.randomUUID();
    const createdAt = Date.now();
    await env.DB.prepare(`
      INSERT INTO posts (
        id, title, cat, date, icon, color, excerpt, content, image_url, image_path, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      String(body.title),
      String(body.cat),
      String(body.date),
      String(body.icon || "📰"),
      Number(body.color ?? 0),
      String(body.excerpt),
      String(body.content || body.excerpt),
      String(body.imageUrl || ""),
      String(body.imagePath || ""),
      createdAt
    ).run();

    return json({ id, ok: true });
  }

  if (path.startsWith("/api/posts/") && method === "DELETE") {
    const user = await requireAuth(request, env);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const id = getId(path, "/api/posts/");
    await env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  // NOTICES
  if (path === "/api/notices" && method === "GET") {
    const result = await env.DB.prepare(
      "SELECT * FROM notices ORDER BY sort_order ASC, created_at DESC"
    ).all();
    return json(result.results || []);
  }

  if (path === "/api/notices" && method === "POST") {
    const user = await requireAuth(request, env);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await readJson(request);
    if (!body?.text) return json({ error: "Thiếu nội dung thông báo" }, 400);

    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO notices (id, text, sort_order, created_at) VALUES (?, ?, ?, ?)"
    ).bind(
      id,
      String(body.text),
      Number(body.order ?? 0),
      Date.now()
    ).run();

    return json({ id, ok: true });
  }

  if (path.startsWith("/api/notices/") && method === "DELETE") {
    const user = await requireAuth(request, env);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const id = getId(path, "/api/notices/");
    await env.DB.prepare("DELETE FROM notices WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  // DOCUMENTS
  if (path === "/api/documents" && method === "GET") {
    const result = await env.DB.prepare(
      "SELECT * FROM documents ORDER BY date DESC, created_at DESC"
    ).all();
    return json(result.results || []);
  }

  if (path === "/api/documents" && method === "POST") {
    const user = await requireAuth(request, env);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await readJson(request);
    if (!body?.code || !body?.title) {
      return json({ error: "Thiếu code hoặc title" }, 400);
    }

    const id = crypto.randomUUID();
    await env.DB.prepare(`
      INSERT INTO documents (
        id, code, title, date, description, file_url, file_path, file_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      String(body.code),
      String(body.title),
      String(body.date || ""),
      String(body.desc || ""),
      String(body.fileUrl || ""),
      String(body.filePath || ""),
      String(body.fileName || ""),
      Date.now()
    ).run();

    return json({ id, ok: true });
  }

  if (path.startsWith("/api/documents/") && method === "DELETE") {
    const user = await requireAuth(request, env);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const id = getId(path, "/api/documents/");
    await env.DB.prepare("DELETE FROM documents WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  // SETTINGS
  if (path === "/api/settings" && method === "GET") {
    const row = await env.DB.prepare(
      "SELECT value FROM settings WHERE key = 'site'"
    ).first();

    if (!row) return json({});

    try {
      return json(JSON.parse(row.value));
    } catch {
      return json({});
    }
  }

  if (path === "/api/settings" && method === "POST") {
    const user = await requireAuth(request, env);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await readJson(request);
    const value = JSON.stringify(body ?? {});

    await env.DB.prepare(`
      INSERT INTO settings (key, value) VALUES ('site', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).bind(value).run();

    return json({ ok: true });
  }

  // STATS
  if (path === "/api/stats" && method === "GET") {
    const now = Date.now();
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(now - 7 * 86400000).toISOString().split("T")[0];

    const totalRow = await env.DB.prepare("SELECT COUNT(*) as c FROM visits").first();
    const todayRow = await env.DB.prepare("SELECT COUNT(*) as c FROM visits WHERE day = ?").bind(today).first();
    const weekRow = await env.DB.prepare("SELECT COUNT(*) as c FROM visits WHERE day >= ?").bind(weekAgo).first();
    const onlineRow = await env.DB.prepare(
      "SELECT COUNT(DISTINCT sid) as c FROM presence WHERE last_seen > ?"
    ).bind(now - 60000).first();

    return json({
      total: Number(totalRow?.c || 0),
      today: Number(todayRow?.c || 0),
      week: Number(weekRow?.c || 0),
      online: Number(onlineRow?.c || 0)
    });
  }

  if (path === "/api/stats/hit" && method === "POST") {
    const today = new Date().toISOString().split("T")[0];
    await env.DB.prepare(
      "INSERT INTO visits (day, ts) VALUES (?, ?)"
    ).bind(today, Date.now()).run();
    return json({ ok: true });
  }

  // PRESENCE
  if (path === "/api/presence" && method === "POST") {
    const body = await readJson(request);
    if (!body?.sid) return json({ error: "missing sid" }, 400);

    const sid = String(body.sid);
    const now = Date.now();

    if (body.remove === true) {
      await env.DB.prepare("DELETE FROM presence WHERE sid = ?").bind(sid).run();
      return json({ ok: true });
    }

    await env.DB.prepare(`
      INSERT INTO presence (sid, last_seen) VALUES (?, ?)
      ON CONFLICT(sid) DO UPDATE SET last_seen = excluded.last_seen
    `).bind(sid, now).run();

    await env.DB.prepare("DELETE FROM presence WHERE last_seen < ?")
      .bind(now - 120000)
      .run();

    return json({ ok: true });
  }

  // UPLOAD R2: ảnh / video / PDF / file bất kỳ đều trả URL dùng ngay.
  if (path === "/api/upload" && method === "POST") {
    const user = await requireAuth(request, env);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const form = await request.formData();
    const file = form.get("file");
    const folder = sanitizeFolder(form.get("folder") || "misc");

    if (!(file instanceof File)) {
      return json({ error: "Không có file" }, 400);
    }

    const ext = getExtension(file.name);
    const uuid8 = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    const key = `${folder}/${Date.now()}_${uuid8}.${ext}`;

    await env.BUCKET.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type || "application/octet-stream"
      }
    });

    const url = new URL(`/files/${key}`, request.url).toString();
    return json({ ok: true, path: `/files/${key}`, url, key });
  }

  return json({ error: "Not found: " + path }, 404);
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method.toUpperCase();

      // OPTIONS preflight
      if (method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS });
      }

      // R2 public files
      if (path.startsWith("/files/") && method === "GET") {
        const key = decodeURIComponent(path.slice("/files/".length));
        if (!key) return json({ error: "File not found" }, 404);

        const obj = await env.BUCKET.get(key);
        if (obj === null) return json({ error: "File not found" }, 404);

        const headers = {
          "Content-Type": obj.httpMetadata?.contentType || "application/octet-stream",
          "Cache-Control": "public, max-age=31536000",
          ...CORS
        };
        if (obj.httpEtag) headers["ETag"] = obj.httpEtag;
        if (obj.size != null) headers["Content-Length"] = String(obj.size);

        return new Response(obj.body, { status: 200, headers });
      }

      // API
      if (path.startsWith("/api/")) {
        return await handleAPI(request, env, path, method);
      }

      // Static assets
      const assetResponse = await env.ASSETS.fetch(request);
      return withCors(assetResponse);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 500);
    }
  }
};
