const OPENAI_RUNTIME_AZURE_BLOB_HOST = /^oaisdmntpr[a-z0-9]+\.blob\.core\.windows\.net$/;

export function isAllowedOpenAiFileUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return (
      host === "oaiusercontent.com" ||
      host.endsWith(".oaiusercontent.com") ||
      host === "openai.com" ||
      host.endsWith(".openai.com") ||
      host === "chatgpt.com" ||
      host.endsWith(".chatgpt.com") ||
      OPENAI_RUNTIME_AZURE_BLOB_HOST.test(host)
    );
  } catch {
    return false;
  }
}
