const ALLOWED_ORIGIN = "https://yoga-bari.pages.dev";

function getCookie(header, name) {
  if (!header) return null;
  const match = header.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // /auth → genera state anti-CSRF (salvato in cookie), redirect a GitHub OAuth
    if (path === "/auth") {
      const state = crypto.randomUUID();
      const params = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        scope: "repo,user",
        redirect_uri: `${url.origin}/callback`,
        state,
      });
      return new Response(null, {
        status: 302,
        headers: {
          Location: `https://github.com/login/oauth/authorize?${params}`,
          "Set-Cookie": `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/`,
        },
      });
    }

    // /callback → verifica state anti-CSRF, scambia code per token, risposta per Sveltia CMS
    if (path === "/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const cookieState = getCookie(request.headers.get("Cookie"), "oauth_state");

      if (!code) {
        return new Response("Missing code", { status: 400 });
      }
      if (!state || !cookieState || state !== cookieState) {
        return new Response("Invalid or missing state (possible CSRF)", { status: 400 });
      }

      const tokenResp = await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: `${url.origin}/callback`,
          }),
        }
      );

      const data = await tokenResp.json();

      if (data.error) {
        return new Response(`OAuth error: ${data.error_description}`, {
          status: 400,
        });
      }

      const tokenData = JSON.stringify(data);
      const script = `<!DOCTYPE html>
<html>
<head><title>Authenticating...</title></head>
<body>
<script>
(function() {
  function receiveMessage(e) {
    window.opener.postMessage(
      'authorization:github:success:' + JSON.stringify(${tokenData}),
      e.origin
    );
  }
  window.addEventListener("message", receiveMessage, false);
  window.opener.postMessage("authorizing:github", "*");
})();
<\/script>
<p>Autenticazione completata. Puoi chiudere questa finestra.</p>
</body>
</html>`;

      return new Response(script, {
        headers: {
          "Content-Type": "text/html",
          "Set-Cookie": "oauth_state=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/",
        },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
