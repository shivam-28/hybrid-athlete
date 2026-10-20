const FOUNDRY_HOST = /^([a-z0-9-]+)\.services\.ai\.azure\.com$/;
const DEPLOYMENT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/**
 * Accepts only `https://<resource>.services.ai.azure.com/anthropic[/]` and returns the
 * resource name. Everything else is rejected before any request is made (SSRF guard):
 * the client is then built from the resource name, never from the user's string.
 */
export function parseFoundryEndpoint(input: string): { resource: string; endpoint: string } | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) return null;
  if (url.pathname !== "/anthropic" && url.pathname !== "/anthropic/") return null;
  const resource = FOUNDRY_HOST.exec(url.hostname)?.[1];
  return resource ? { resource, endpoint: `https://${resource}.services.ai.azure.com/anthropic` } : null;
}

export function isValidDeploymentName(name: string): boolean {
  return DEPLOYMENT_NAME.test(name);
}
