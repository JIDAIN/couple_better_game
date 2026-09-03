import {
  authenticateFixedLifeAccount,
  resolveFixedLifeIdentity,
} from "@/lib/server/fixed-life-auth";
import {
  createAuthorizationCode,
  normalizeScopes,
  resolveRegisteredClient,
} from "@/lib/server/life-mcp-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AuthorizationParams = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  resource: string;
  scope: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function html(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function oauthError(error: string, description: string, status = 400) {
  return Response.json(
    { error, error_description: description },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function parseGetParams(request: Request): AuthorizationParams | null {
  const url = new URL(request.url);
  if (url.searchParams.get("response_type") !== "code") return null;
  if (url.searchParams.get("code_challenge_method") !== "S256") return null;
  const clientId = url.searchParams.get("client_id")?.trim() ?? "";
  const redirectUri = url.searchParams.get("redirect_uri")?.trim() ?? "";
  const codeChallenge = url.searchParams.get("code_challenge")?.trim() ?? "";
  const state = url.searchParams.get("state") ?? "";
  const resource = url.searchParams.get("resource")?.trim() ?? "";
  const scope = url.searchParams.get("scope") ?? "";
  if (!clientId || !redirectUri || !codeChallenge || !resource) return null;
  return { clientId, redirectUri, codeChallenge, state, resource, scope };
}

function validateParams(request: Request, params: AuthorizationParams) {
  const client = resolveRegisteredClient(params.clientId);
  if (!client || !client.redirectUris.includes(params.redirectUri)) return false;
  const expectedResource = `${new URL(request.url).origin}/mcp`;
  if (params.resource !== expectedResource) return false;
  return /^[A-Za-z0-9_-]{43,128}$/.test(params.codeChallenge);
}

function finishAuthorization(params: AuthorizationParams, partnerKey: "cat" | "fish") {
  const code = createAuthorizationCode({
    clientId: params.clientId,
    redirectUri: params.redirectUri,
    codeChallenge: params.codeChallenge,
    partnerKey,
    resource: params.resource,
    scope: normalizeScopes(params.scope),
  });
  const redirect = new URL(params.redirectUri);
  redirect.searchParams.set("code", code);
  if (params.state) redirect.searchParams.set("state", params.state);
  return Response.redirect(redirect, 303);
}

function loginPage(params: AuthorizationParams, errorMessage = "") {
  const fields = [
    ["client_id", params.clientId],
    ["redirect_uri", params.redirectUri],
    ["code_challenge", params.codeChallenge],
    ["state", params.state],
    ["resource", params.resource],
    ["scope", params.scope],
  ]
    .map(([name, value]) => `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`)
    .join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>连接 🐟🐱生活记录</title>
<style>
:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#fff7f5;color:#372c2b;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{min-height:100vh;display:grid;place-items:center;padding:24px}.card{width:min(420px,100%);background:#fff;border:1px solid #f0ddd8;border-radius:24px;padding:28px;box-shadow:0 18px 60px rgba(100,65,55,.10)}h1{font-size:24px;margin:0 0 8px}p{line-height:1.6;color:#77615e;margin:0 0 20px}.field{display:grid;gap:7px;margin:14px 0}label{font-size:14px;font-weight:650}input{width:100%;border:1px solid #dfcfcb;border-radius:14px;padding:12px 14px;font:inherit;background:#fff}button{width:100%;border:0;border-radius:14px;padding:13px 16px;margin-top:8px;background:#e87867;color:#fff;font:inherit;font-weight:750;cursor:pointer}.error{background:#fff0ee;color:#a63d31;border-radius:12px;padding:10px 12px;margin:0 0 14px;font-size:14px}.note{font-size:13px;color:#8f7773;margin-top:16px}</style>
</head>
<body><main class="wrap"><section class="card">
<h1>连接 🐟🐱生活记录</h1>
<p>使用你在生活程序中的固定账号登录。连接后，ChatGPT 只会以该账号对应的“我”访问个人记录。</p>
${errorMessage ? `<div class="error">${escapeHtml(errorMessage)}</div>` : ""}
<form method="post" action="/oauth/authorize">
${fields}
<div class="field"><label for="username">账号</label><input id="username" name="username" autocomplete="username" required></div>
<div class="field"><label for="password">密码</label><input id="password" name="password" type="password" autocomplete="current-password" required></div>
<button type="submit">登录并连接</button>
</form>
<div class="note">此页面不会把 Supabase 密钥交给 ChatGPT；授权令牌只允许访问已注册的生活记录能力。</div>
</section></main></body></html>`;
}

export async function GET(request: Request) {
  const params = parseGetParams(request);
  if (!params || !validateParams(request, params)) {
    return oauthError("invalid_request", "OAuth authorization request is invalid");
  }
  const identity = resolveFixedLifeIdentity(request);
  if (identity) return finishAuthorization(params, identity.partnerKey);
  return html(loginPage(params));
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return oauthError("invalid_request", "Authorization form is invalid");
  }
  const params: AuthorizationParams = {
    clientId: String(form.get("client_id") ?? "").trim(),
    redirectUri: String(form.get("redirect_uri") ?? "").trim(),
    codeChallenge: String(form.get("code_challenge") ?? "").trim(),
    state: String(form.get("state") ?? ""),
    resource: String(form.get("resource") ?? "").trim(),
    scope: String(form.get("scope") ?? ""),
  };
  if (!validateParams(request, params)) {
    return oauthError("invalid_request", "OAuth authorization request is invalid");
  }
  const username = form.get("username");
  const password = form.get("password");
  try {
    const partnerKey = await authenticateFixedLifeAccount(username, password);
    if (!partnerKey) return html(loginPage(params, "账号或密码不正确"), 401);
    return finishAuthorization(params, partnerKey);
  } catch {
    return html(loginPage(params, "暂时无法验证账号，请稍后重试"), 502);
  }
}
