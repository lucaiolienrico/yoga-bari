// Serve il sito direttamente dal branch main del repo: ogni commit del CMS
// diventa live senza bisogno di un nuovo deploy Pages (il progetto Pages non
// ha integrazione Git).
const ORIGIN = "https://raw.githubusercontent.com/lucaiolienrico/yoga-bari/main";

const TYPES = {
  html: "text/html; charset=utf-8",
  json: "application/json; charset=utf-8",
  yml: "text/yaml; charset=utf-8",
  yaml: "text/yaml; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "application/javascript; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  ico: "image/x-icon",
  pdf: "application/pdf",
  mp4: "video/mp4",
  woff2: "font/woff2",
};

const BLOCKED = [/^\/worker\//, /^\/_worker\.js$/, /^\/SETUP\.md$/, /\/\./];

const SECURITY_HEADERS = {
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
};

function resolvePath(pathname) {
  if (pathname === "/admin") return "/admin/index.html";
  if (pathname.endsWith("/")) return pathname + "index.html";
  return pathname;
}

export default {
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }

    const url = new URL(request.url);
    let path;
    try {
      path = resolvePath(decodeURIComponent(url.pathname));
    } catch {
      return new Response("Bad request", { status: 400 });
    }

    if (path.includes("..") || BLOCKED.some((re) => re.test(path))) {
      return new Response("Not found", { status: 404, headers: SECURITY_HEADERS });
    }

    const ext = (path.split(".").pop() || "").toLowerCase();
    const isMedia = /^(png|jpe?g|webp|avif|gif|svg|ico|pdf|mp4|woff2)$/.test(ext);

    let upstream;
    try {
      upstream = await fetch(ORIGIN + encodeURI(path), {
        cf: { cacheTtl: isMedia ? 3600 : 60, cacheEverything: true },
      });
    } catch {
      return new Response("Upstream unavailable", { status: 502, headers: SECURITY_HEADERS });
    }

    if (upstream.status === 404) {
      return new Response("Not found", { status: 404, headers: SECURITY_HEADERS });
    }
    if (!upstream.ok) {
      return new Response("Upstream error", { status: 502, headers: SECURITY_HEADERS });
    }

    return new Response(request.method === "HEAD" ? null : upstream.body, {
      status: 200,
      headers: {
        ...SECURITY_HEADERS,
        "Content-Type": TYPES[ext] || "application/octet-stream",
        "Cache-Control": isMedia ? "public, max-age=3600" : "public, max-age=60",
      },
    });
  },
};
