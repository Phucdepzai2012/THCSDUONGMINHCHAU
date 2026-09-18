/* =========================================================
   THCS CHAO ĐÂU — CLOUDFLARE WORKER API
   Bindings cần: DB (D1), BUCKET (R2)
   Vars: ADMIN_USER, ADMIN_PASS, JWT_SECRET
   ========================================================= */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

// ─── JWT đơn giản (HS256) ─────────────────────
async function sign(payload, secret) {
  const enc = new TextEncoder();
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify({ ...payload, exp: Date.now() + 86400000 }));
  const data = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return data + "." + btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function verify(token, secret) {
  try {
    const [h, b, s] = token.split(".");
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );
    const sig = Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const ok = await crypto.subtle.verify("HMAC", key, sig, enc.encode(`${h}.${b}`));
    if (!ok) return null;
    const payload = JSON.parse(atob(b));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

// ─── Kiểm tra quyền admin ─────────────────────
async function requireAuth(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace("Bearer ", "");
  if (!token) return null;
  return await verify(token, env.JWT_SECRET || "default-secret");
}

// ─── Router chính ─────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "");
    const method = request.method;

    if (method === "OPTIONS") return new Response(null, { headers: CORS });

    // ═══════════════════════════════════════════
    //  AUTH
    // ═══════════════════════════════════════════
    if (path === "/api/login" && method === "POST") {
      const { username, password } = await request.json();
      const u = env.ADMIN_USER || "admin";
      const p = env.ADMIN_PASS || "admin123";
      if (username !== u || password !== p) {
        return json({ error: "Sai tên đăng nhập hoặc mật khẩu" }, 401);
      }
      const token = await sign({ user: username }, env.JWT_SECRET || "default-secret");
      return json({ token });
    }

    if (path === "/api/logout" && method === "POST") {
      return json({ ok: true });
    }

    // ═══════════════════════════════════════════
    //  POSTS
    // ═══════════════════════════════════════════
    if (path === "/api/posts" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM posts ORDER BY date DESC, created_at DESC"
      ).all();
      return json(results || []);
    }

    if (path === "/api/posts" && method === "POST") {
      if (!await requireAuth(request, env)) return json({ error: "Chưa đăng nhập" }, 401);
      const b = await request.json();
      const id = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO posts (id,title,cat,date,icon,color,excerpt,content,image_url,image_path,created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(
        id, b.title, b.cat, b.date, b.icon || "📰", b.color || 0,
        b.excerpt, b.content, b.imageUrl || "", b.imagePath || "", Date.now()
      ).run();
      return json({ id, ok: true });
    }

    if (path.startsWith("/api/posts/") && method === "DELETE") {
      if (!await requireAuth(request, env)) return json({ error: "Chưa đăng nhập" }, 401);
      const id = decodeURIComponent(path.split("/").pop());
      await env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }

    // ═══════════════════════════════════════════
    //  NOTICES
    // ═══════════════════════════════════════════
    if (path === "/api/notices" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM notices ORDER BY sort_order ASC, created_at DESC"
      ).all();
      return json(results || []);
    }

    if (path === "/api/notices" && method === "POST") {
      if (!await requireAuth(request, env)) return json({ error: "Chưa đăng nhập" }, 401);
      const b = await request.json();
      const id = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO notices (id,text,sort_order,created_at) VALUES (?,?,?,?)"
      ).bind(id, b.text, b.order || 0, Date.now()).run();
      return json({ id, ok: true });
    }

    if (path.startsWith("/api/notices/") && method === "DELETE") {
      if (!await requireAuth(request, env)) return json({ error: "Chưa đăng nhập" }, 401);
      const id = decodeURIComponent(path.split("/").pop());
      await env.DB.prepare("DELETE FROM notices WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }

    // ═══════════════════════════════════════════
    //  DOCUMENTS
    // ═══════════════════════════════════════════
    if (path === "/api/documents" && method === "GET") {
      const { results } = await env.DB.prepare(
        "SELECT * FROM documents ORDER BY date DESC, created_at DESC"
      ).all();
      return json(results || []);
    }

    if (path === "/api/documents" && method === "POST") {
      if (!await requireAuth(request, env)) return json({ error: "Chưa đăng nhập" }, 401);
      const b = await request.json();
      const id = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO documents (id,code,title,date,description,file_url,file_path,file_name,created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`
      ).bind(
        id, b.code, b.title, b.date || "", b.desc || "",
        b.fileUrl, b.filePath || "", b.fileName || "", Date.now()
      ).run();
      return json({ id, ok: true });
    }

    if (path.startsWith("/api/documents/") && method === "DELETE") {
      if (!await requireAuth(request, env)) return json({ error: "Chưa đăng nhập" }, 401);
      const id = decodeURIComponent(path.split("/").pop());
      await env.DB.prepare("DELETE FROM documents WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }

    // ═══════════════════════════════════════════
    //  SETTINGS
    // ═══════════════════════════════════════════
    if (path === "/api/settings" && method === "GET") {
      const row = await env.DB.prepare(
        "SELECT value FROM settings WHERE key = 'site'"
      ).first();
      return json(row ? JSON.parse(row.value) : {});
    }

    if (path === "/api/settings" && method === "POST") {
      if (!await requireAuth(request, env)) return json({ error: "Chưa đăng nhập" }, 401);
      const body = await request.json();
      const val = JSON.stringify(body);
      await env.DB.prepare(
        `INSERT INTO settings (key, value) VALUES ('site', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).bind(val).run();
      return json({ ok: true });
    }

    // ═══════════════════════════════════════════
    //  STATS + PRESENCE
    // ═══════════════════════════════════════════
    if (path === "/api/stats" && method === "GET") {
      const today = new Date().toISOString().split("T")[0];
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

      const total = (await env.DB.prepare("SELECT COUNT(*) as c FROM visits").first())?.c || 0;
      const todayC = (await env.DB.prepare("SELECT COUNT(*) as c FROM visits WHERE day = ?").bind(today).first())?.c || 0;
      const weekC = (await env.DB.prepare("SELECT COUNT(*) as c FROM visits WHERE day >= ?").bind(weekAgo).first())?.c || 0;
      const online = (await env.DB.prepare(
        "SELECT COUNT(DISTINCT sid) as c FROM presence WHERE last_seen > ?"
      ).bind(Date.now() - 60000).first())?.c || 0;

      return json({ total, today: todayC, week: weekC, online });
    }

    if (path === "/api/stats/hit" && method === "POST") {
      const today = new Date().toISOString().split("T")[0];
      await env.DB.prepare(
        "INSERT INTO visits (day, ts) VALUES (?, ?)"
      ).bind(today, Date.now()).run();
      return json({ ok: true });
    }

    if (path === "/api/presence" && method === "POST") {
      const { sid, remove } = await request.json();
      if (!sid) return json({ error: "missing sid" }, 400);
      if (remove) {
        await env.DB.prepare("DELETE FROM presence WHERE sid = ?").bind(sid).run();
      } else {
        await env.DB.prepare(
          `INSERT INTO presence (sid, last_seen) VALUES (?, ?)
           ON CONFLICT(sid) DO UPDATE SET last_seen = excluded.last_seen`
        ).bind(sid, Date.now()).run();
        // dọn session cũ > 2 phút
        await env.DB.prepare("DELETE FROM presence WHERE last_seen < ?")
          .bind(Date.now() - 120000).run();
      }
      return json({ ok: true });
    }

    // ═══════════════════════════════════════════
    //  UPLOAD (R2)
    // ═══════════════════════════════════════════
    if (path === "/api/upload" && method === "POST") {
      if (!await requireAuth(request, env)) return json({ error: "Chưa đăng nhập" }, 401);
      const form = await request.formData();
      const file = form.get("file");
      const folder = form.get("folder") || "misc";
      if (!file) return json({ error: "Không có file" }, 400);

      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const key = `${folder}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
      await env.BUCKET.put(key, file.stream(), {
        httpMetadata: { contentType: file.type || "application/octet-stream" },
      });

      return json({
        ok: true,
        path: "/files/" + key,
        url: "/files/" + key,
        key,
      });
    }

    // ═══════════════════════════════════════════
    //  SERVE FILE TỪ R2
    // ═══════════════════════════════════════════
    if (path.startsWith("/files/")) {
      const key = path.replace("/files/", "");
      const obj = await env.BUCKET.get(key);
      if (!obj) return new Response("Not found", { status: 404 });
      return new Response(obj.body, {
        headers: {
          "Content-Type": obj.httpMetadata?.contentType || "application/octet-stream",
          "Cache-Control": "public, max-age=31536000",
          ...CORS,
        },
      });
    }

    return json({ error: "Not found: " + path }, 404);
  },
};
