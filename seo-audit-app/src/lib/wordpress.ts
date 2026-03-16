import type { WPConnection, WPPage } from "@/types";

function authHeader(conn: WPConnection): string {
  return (
    "Basic " +
    Buffer.from(`${conn.username}:${conn.appPassword}`).toString("base64")
  );
}

function apiBase(conn: WPConnection): string {
  return `${conn.siteUrl.replace(/\/+$/, "")}/wp-json/wp/v2`;
}

export async function testConnection(
  conn: WPConnection
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${apiBase(conn)}/users/me`, {
      headers: { Authorization: authHeader(conn) },
    });
    if (res.ok) return { ok: true };
    if (res.status === 401)
      return { ok: false, error: "Invalid credentials. Check your username and application password." };
    return { ok: false, error: `WordPress API returned status ${res.status}` };
  } catch (err) {
    return {
      ok: false,
      error: `Could not connect to ${conn.siteUrl}. Make sure the WordPress REST API is enabled.`,
    };
  }
}

export async function fetchPages(conn: WPConnection): Promise<WPPage[]> {
  const allPages: WPPage[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `${apiBase(conn)}/pages?per_page=100&page=${page}&_fields=id,title,content,link,slug`,
      { headers: { Authorization: authHeader(conn) } }
    );
    if (!res.ok) break;
    const data: WPPage[] = await res.json();
    if (data.length === 0) break;
    allPages.push(...data.map((p) => ({ ...p, type: "page" as const })));
    page++;
    if (data.length < 100) break;
  }

  return allPages;
}

export async function fetchPosts(conn: WPConnection): Promise<WPPage[]> {
  const allPosts: WPPage[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `${apiBase(conn)}/posts?per_page=100&page=${page}&_fields=id,title,content,link,slug`,
      { headers: { Authorization: authHeader(conn) } }
    );
    if (!res.ok) break;
    const data: WPPage[] = await res.json();
    if (data.length === 0) break;
    allPosts.push(...data.map((p) => ({ ...p, type: "post" as const })));
    page++;
    if (data.length < 100) break;
  }

  return allPosts;
}

export async function fetchAllContent(conn: WPConnection): Promise<WPPage[]> {
  const [pages, posts] = await Promise.all([
    fetchPages(conn),
    fetchPosts(conn),
  ]);
  return [...pages, ...posts];
}
