// ─── COGNITO AUTH (PKCE flow, no SDK needed) ────────────────────────────────
const Auth = (() => {
  const TOKEN_KEY = "st_tokens";
  const VERIFIER_KEY = "st_pkce_verifier";

  function base64url(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  async function generatePKCE() {
    const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    const challenge = base64url(digest);
    return { verifier, challenge };
  }

  function getTokens() {
    try { return JSON.parse(localStorage.getItem(TOKEN_KEY)); } catch { return null; }
  }

  function saveTokens(tokens) {
    tokens.expires_at = Date.now() + tokens.expires_in * 1000;
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  }

  function clearTokens() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(VERIFIER_KEY);
  }

  function parseJwt(token) {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  }

  function getUser() {
    const tokens = getTokens();
    if (!tokens?.id_token) return null;
    try {
      const claims = parseJwt(tokens.id_token);
      return { sub: claims.sub, email: claims.email, name: claims.name || claims.email.split("@")[0] };
    } catch { return null; }
  }

  function getIdToken() {
    const tokens = getTokens();
    if (!tokens) return null;
    if (Date.now() > (tokens.expires_at || 0) - 60000) return null; // expired
    return tokens.id_token;
  }

  async function login() {
    const { verifier, challenge } = await generatePKCE();
    sessionStorage.setItem(VERIFIER_KEY, verifier);
    const params = new URLSearchParams({
      response_type: "code",
      client_id: APP_CONFIG.COGNITO_CLIENT_ID,
      redirect_uri: APP_CONFIG.REDIRECT_URI,
      scope: "email openid profile",
      code_challenge_method: "S256",
      code_challenge: challenge,
    });
    window.location.href = `${APP_CONFIG.COGNITO_DOMAIN}/login?${params}`;
  }

  async function handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return false;

    const verifier = sessionStorage.getItem(VERIFIER_KEY);
    if (!verifier) { console.warn("No PKCE verifier"); return false; }

    try {
      const res = await fetch(`${APP_CONFIG.COGNITO_DOMAIN}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: APP_CONFIG.COGNITO_CLIENT_ID,
          redirect_uri: APP_CONFIG.REDIRECT_URI,
          code,
          code_verifier: verifier,
        }),
      });
      if (!res.ok) throw new Error("Token exchange failed");
      const tokens = await res.json();
      saveTokens(tokens);
      sessionStorage.removeItem(VERIFIER_KEY);
      window.history.replaceState({}, "", "/");
      return true;
    } catch (e) {
      console.error("Auth callback error:", e);
      return false;
    }
  }

  async function refreshToken() {
    const tokens = getTokens();
    if (!tokens?.refresh_token) return false;
    try {
      const res = await fetch(`${APP_CONFIG.COGNITO_DOMAIN}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: APP_CONFIG.COGNITO_CLIENT_ID,
          refresh_token: tokens.refresh_token,
        }),
      });
      if (!res.ok) return false;
      const newTokens = await res.json();
      newTokens.refresh_token = tokens.refresh_token; // keep refresh token
      saveTokens(newTokens);
      return true;
    } catch { return false; }
  }

  function logout() {
    clearTokens();
    const params = new URLSearchParams({
      client_id: APP_CONFIG.COGNITO_CLIENT_ID,
      logout_uri: APP_CONFIG.REDIRECT_URI,
    });
    window.location.href = `${APP_CONFIG.COGNITO_DOMAIN}/logout?${params}`;
  }

  function isLoggedIn() {
    return !!getIdToken();
  }

  return { login, logout, handleCallback, refreshToken, getUser, getIdToken, isLoggedIn, getTokens };
})();
