const ALLOWED_REDIRECT_HOSTS = new Set([
  "script.googleusercontent.com",
  "script.google.com",
]);

export type GoogleWebAppHop = {
  status: number;
  host: string;
  contentType: string | null;
};

export function parseAllowedGoogleWebAppRedirect(
  location: string | null,
  baseUrl: string,
): URL | null {
  if (!location) return null;
  let target: URL;
  try {
    target = new URL(location, baseUrl);
  } catch {
    return null;
  }
  if (target.protocol !== "https:" || !ALLOWED_REDIRECT_HOSTS.has(target.hostname)) {
    return null;
  }
  return target;
}

export function googleWebAppHop(response: Response): GoogleWebAppHop {
  let host = "unknown";
  try {
    host = new URL(response.url).hostname || "unknown";
  } catch {}
  return {
    status: response.status,
    host,
    contentType: response.headers.get("content-type"),
  };
}
