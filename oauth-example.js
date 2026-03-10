/**
 * Exemplo de OAuth 2.0 - Fluxo Authorization Code (Node.js puro, sem Express)
 *
 * Passo a passo:
 * 1. Registrar seu app no provedor (Google, GitHub, iFood, etc.) e obter:
 *    - client_id
 *    - client_secret
 *    - redirect_uri (ex: http://localhost:3000/callback)
 * 2. Rodar: node oauth-example.js
 * 3. Abrir no navegador a URL que aparecer no console (ex: http://localhost:3000/login)
 * 4. Fazer login no provedor; você será redirecionado de volta e verá os tokens no console
 *
 * Configure as variáveis abaixo conforme o provedor que for usar.
 */

import http from "http";

const PORT = 3000;

// ========== CONFIGURAÇÃO – preencha conforme o provedor (Google, GitHub, etc.) ==========
const OAUTH_CONFIG = {
  // Onde o usuário faz login (autorização)
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  // Onde trocar o "code" por access_token e refresh_token
  tokenEndpoint: "https://oauth2.googleapis.com/token",

  clientId: process.env.OAUTH_CLIENT_ID || "SEU_CLIENT_ID",
  clientSecret: process.env.OAUTH_CLIENT_SECRET || "SEU_CLIENT_SECRET",

  // Deve ser exatamente o que está cadastrado no console do provedor
  redirectUri: `http://localhost:${PORT}/callback`,

  // Escopos que você quer pedir (depende do provedor)
  scope: "openid email profile",
};

// Estado aleatório para proteção CSRF
function gerarState() {
  return Buffer.from(Math.random().toString(36) + Date.now()).toString("base64url");
}

// Monta a URL para o usuário autorizar o app
function urlDeAutorizacao(state) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: OAUTH_CONFIG.clientId,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    scope: OAUTH_CONFIG.scope,
    state,
  });
  return `${OAUTH_CONFIG.authorizationEndpoint}?${params.toString()}`;
}

// Troca o "code" por access_token (e opcionalmente refresh_token)
async function trocarCodePorTokens(code) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: OAUTH_CONFIG.redirectUri,
    client_id: OAUTH_CONFIG.clientId,
    client_secret: OAUTH_CONFIG.clientSecret,
  });

  const res = await fetch(OAUTH_CONFIG.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  return res.json();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  // Rota: /login -> redireciona para o provedor OAuth
  if (url.pathname === "/login") {
    const state = gerarState();
    // Em produção você guardaria o state na sessão para validar no callback
    const authUrl = urlDeAutorizacao(state);
    res.writeHead(302, { Location: authUrl });
    res.end();
    return;
  }

  // Rota: /callback -> recebe ?code=...&state=... e troca por tokens
  if (url.pathname === "/callback") {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(`<p>Erro do provedor: ${error}</p><p>description: ${url.searchParams.get("error_description") || ""}</p>`);
      return;
    }

    if (!code) {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end("Missing code");
      return;
    }

    try {
      const tokens = await trocarCodePorTokens(code);
      console.log("Tokens recebidos:", JSON.stringify(tokens, null, 2));

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        "<h2>OAuth concluído</h2>" +
          "<p>Access token (primeiros 50 chars): <code>" +
          (tokens.access_token || "").slice(0, 50) +
          "...</code></p>" +
          "<p>Veja o console do Node para o JSON completo.</p>"
      );
    } catch (err) {
      console.error(err);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Erro ao trocar code por tokens: " + err.message);
    }
    return;
  }

  // Rota raiz: link para iniciar o fluxo
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(
    `<h1>Exemplo OAuth</h1><p><a href="/login">Fazer login (OAuth)</a></p>`
  );
});

server.listen(PORT, () => {
  console.log(`Servidor OAuth em http://localhost:${PORT}`);
  console.log(`Abra no navegador: http://localhost:${PORT}/login`);
  console.log("");
  console.log("Configure OAUTH_CLIENT_ID e OAUTH_CLIENT_SECRET (ou edite o arquivo).");
  console.log("Para Google: https://console.cloud.google.com/apis/credentials");
});
