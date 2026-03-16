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

// --- Write operations (Phase 2) ---

export async function updatePageTitle(
  conn: WPConnection,
  pageId: number,
  newTitle: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${apiBase(conn)}/pages/${pageId}`, {
      method: "PUT",
      headers: {
        Authorization: authHeader(conn),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: newTitle }),
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: `WordPress returned status ${res.status}` };
  } catch {
    return { ok: false, error: "Failed to connect to WordPress" };
  }
}

export async function updatePostTitle(
  conn: WPConnection,
  postId: number,
  newTitle: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${apiBase(conn)}/posts/${postId}`, {
      method: "PUT",
      headers: {
        Authorization: authHeader(conn),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: newTitle }),
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: `WordPress returned status ${res.status}` };
  } catch {
    return { ok: false, error: "Failed to connect to WordPress" };
  }
}

export async function updateContent(
  conn: WPConnection,
  contentType: "pages" | "posts",
  contentId: number,
  updates: { title?: string; content?: string }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${apiBase(conn)}/${contentType}/${contentId}`, {
      method: "PUT",
      headers: {
        Authorization: authHeader(conn),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    });
    if (res.ok) return { ok: true };
    const errorData = await res.json().catch(() => ({}));
    return {
      ok: false,
      error: (errorData as { message?: string }).message || `WordPress returned status ${res.status}`,
    };
  } catch {
    return { ok: false, error: "Failed to connect to WordPress" };
  }
}

export async function findWPContentByUrl(
  conn: WPConnection,
  pageUrl: string
): Promise<{ id: number; type: "pages" | "posts" } | null> {
  // Try to find by matching the URL slug
  const url = new URL(pageUrl);
  const slug = url.pathname.replace(/^\/|\/$/g, "").split("/").pop() || "";

  // Search pages first
  const pagesRes = await fetch(
    `${apiBase(conn)}/pages?slug=${encodeURIComponent(slug)}&_fields=id`,
    { headers: { Authorization: authHeader(conn) } }
  );
  if (pagesRes.ok) {
    const pages = await pagesRes.json();
    if (Array.isArray(pages) && pages.length > 0) {
      return { id: pages[0].id, type: "pages" };
    }
  }

  // Then search posts
  const postsRes = await fetch(
    `${apiBase(conn)}/posts?slug=${encodeURIComponent(slug)}&_fields=id`,
    { headers: { Authorization: authHeader(conn) } }
  );
  if (postsRes.ok) {
    const posts = await postsRes.json();
    if (Array.isArray(posts) && posts.length > 0) {
      return { id: posts[0].id, type: "posts" };
    }
  }

  return null;
}
