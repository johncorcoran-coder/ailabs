import type { WPConnection, WPPage } from "@/types";

const WP_TIMEOUT_MS = 15000;
const USER_AGENT = "SEOAuditApp/1.0 (WordPress REST API Client)";

function authHeader(conn: WPConnection): string {
  return (
    "Basic " +
    Buffer.from(`${conn.username}:${conn.appPassword}`).toString("base64")
  );
}

function apiBase(conn: WPConnection): string {
  return `${conn.siteUrl.replace(/\/+$/, "")}/wp-json/wp/v2`;
}

function wpHeaders(conn: WPConnection, extra?: Record<string, string>): Record<string, string> {
  return {
    "User-Agent": USER_AGENT,
    Authorization: authHeader(conn),
    ...extra,
  };
}

export async function testConnection(
  conn: WPConnection
): Promise<{ ok: boolean; error?: string; capabilities?: string[] }> {
  // First check if the REST API is accessible at all
  try {
    const discoveryRes = await fetch(
      `${conn.siteUrl.replace(/\/+$/, "")}/wp-json/`,
      {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(WP_TIMEOUT_MS),
      }
    );
    if (!discoveryRes.ok) {
      if (discoveryRes.status === 404) {
        return {
          ok: false,
          error:
            "WordPress REST API not found. Make sure your site has the REST API enabled. Some security plugins may disable it.",
        };
      }
      return {
        ok: false,
        error: `WordPress responded with status ${discoveryRes.status}. The REST API may be restricted.`,
      };
    }
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === "TimeoutError" || err.message.includes("timeout")) {
        return {
          ok: false,
          error: `Connection timed out after ${WP_TIMEOUT_MS / 1000}s. The server may be slow or unreachable.`,
        };
      }
      if (
        err.message.includes("ECONNREFUSED") ||
        err.message.includes("ENOTFOUND")
      ) {
        return {
          ok: false,
          error: `Could not connect to ${conn.siteUrl}. Please verify the URL is correct and the server is running.`,
        };
      }
    }
    return {
      ok: false,
      error: `Could not reach ${conn.siteUrl}. Please check the URL and try again.`,
    };
  }

  // Test authentication
  try {
    const res = await fetch(`${apiBase(conn)}/users/me`, {
      headers: wpHeaders(conn),
      signal: AbortSignal.timeout(WP_TIMEOUT_MS),
    });

    if (res.ok) {
      const userData = await res.json();
      const capabilities: string[] = [];

      // Check for common capabilities
      if (userData.capabilities?.edit_posts) capabilities.push("edit_posts");
      if (userData.capabilities?.edit_pages) capabilities.push("edit_pages");
      if (userData.capabilities?.manage_options)
        capabilities.push("manage_options");

      return { ok: true, capabilities };
    }

    if (res.status === 401) {
      return {
        ok: false,
        error:
          "Invalid credentials. Check your username and application password. Make sure you're using an Application Password, not your regular WordPress password.",
      };
    }
    if (res.status === 403) {
      return {
        ok: false,
        error:
          "Access forbidden. Your WordPress user may not have permission to access the REST API. Check that your user role is Administrator or Editor.",
      };
    }

    const errorBody = await res.json().catch(() => ({}));
    const wpMessage = (errorBody as { message?: string }).message;
    return {
      ok: false,
      error: wpMessage
        ? `WordPress error: ${wpMessage}`
        : `WordPress API returned status ${res.status}`,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return {
        ok: false,
        error: "Authentication request timed out. Please try again.",
      };
    }
    const detail = err instanceof Error ? err.message : String(err);
    console.error("WP auth error:", detail);
    return {
      ok: false,
      error: `Could not authenticate with ${conn.siteUrl}. The server may be blocking API requests. (${detail})`,
    };
  }
}

export async function fetchPages(conn: WPConnection): Promise<WPPage[]> {
  const allPages: WPPage[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `${apiBase(conn)}/pages?per_page=100&page=${page}&_fields=id,title,content,link,slug`,
      {
        headers: wpHeaders(conn),
        signal: AbortSignal.timeout(WP_TIMEOUT_MS),
      }
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
      {
        headers: wpHeaders(conn),
        signal: AbortSignal.timeout(WP_TIMEOUT_MS),
      }
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

// --- Read operations (single item) ---

export async function fetchContentById(
  conn: WPConnection,
  contentType: "pages" | "posts",
  contentId: number
): Promise<string | null> {
  try {
    const res = await fetch(
      `${apiBase(conn)}/${contentType}/${contentId}?_fields=content`,
      {
        headers: wpHeaders(conn),
        signal: AbortSignal.timeout(WP_TIMEOUT_MS),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.content?.rendered || data.content?.raw || null;
  } catch {
    return null;
  }
}

// --- Write operations ---

export async function updatePageTitle(
  conn: WPConnection,
  pageId: number,
  newTitle: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${apiBase(conn)}/pages/${pageId}`, {
      method: "PUT",
      headers: wpHeaders(conn, { "Content-Type": "application/json" }),
      body: JSON.stringify({ title: newTitle }),
      signal: AbortSignal.timeout(WP_TIMEOUT_MS),
    });
    if (res.ok) return { ok: true };
    return formatWPWriteError(res);
  } catch (err) {
    return formatWPNetworkError(err);
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
      headers: wpHeaders(conn, { "Content-Type": "application/json" }),
      body: JSON.stringify({ title: newTitle }),
      signal: AbortSignal.timeout(WP_TIMEOUT_MS),
    });
    if (res.ok) return { ok: true };
    return formatWPWriteError(res);
  } catch (err) {
    return formatWPNetworkError(err);
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
      headers: wpHeaders(conn, { "Content-Type": "application/json" }),
      body: JSON.stringify(updates),
      signal: AbortSignal.timeout(WP_TIMEOUT_MS),
    });
    if (res.ok) return { ok: true };
    return formatWPWriteError(res);
  } catch (err) {
    return formatWPNetworkError(err);
  }
}

export async function findWPContentByUrl(
  conn: WPConnection,
  pageUrl: string
): Promise<{ id: number; type: "pages" | "posts" } | null> {
  const url = new URL(pageUrl);
  const slug = url.pathname.replace(/^\/|\/$/g, "").split("/").pop() || "";

  // Search pages first
  try {
    const pagesRes = await fetch(
      `${apiBase(conn)}/pages?slug=${encodeURIComponent(slug)}&_fields=id`,
      {
        headers: wpHeaders(conn),
        signal: AbortSignal.timeout(WP_TIMEOUT_MS),
      }
    );
    if (pagesRes.ok) {
      const pages = await pagesRes.json();
      if (Array.isArray(pages) && pages.length > 0) {
        return { id: pages[0].id, type: "pages" };
      }
    }
  } catch {
    // Continue to posts
  }

  // Then search posts
  try {
    const postsRes = await fetch(
      `${apiBase(conn)}/posts?slug=${encodeURIComponent(slug)}&_fields=id`,
      {
        headers: wpHeaders(conn),
        signal: AbortSignal.timeout(WP_TIMEOUT_MS),
      }
    );
    if (postsRes.ok) {
      const posts = await postsRes.json();
      if (Array.isArray(posts) && posts.length > 0) {
        return { id: posts[0].id, type: "posts" };
      }
    }
  } catch {
    // Not found
  }

  return null;
}

// --- Error formatting helpers ---

async function formatWPWriteError(
  res: Response
): Promise<{ ok: false; error: string }> {
  const errorData = await res.json().catch(() => ({}));
  const wpMessage = (errorData as { message?: string }).message;

  if (res.status === 401) {
    return {
      ok: false,
      error:
        "Authentication failed. Your application password may have expired. Please reconnect your site.",
    };
  }
  if (res.status === 403) {
    return {
      ok: false,
      error:
        "Permission denied. Your WordPress user doesn't have permission to edit this content. Check your user role.",
    };
  }
  if (res.status === 429) {
    return {
      ok: false,
      error:
        "Rate limited by WordPress. Please wait a moment and try again.",
    };
  }

  return {
    ok: false,
    error: wpMessage || `WordPress returned status ${res.status}`,
  };
}

function formatWPNetworkError(err: unknown): { ok: false; error: string } {
  if (err instanceof Error) {
    if (err.name === "TimeoutError" || err.message.includes("timeout")) {
      return {
        ok: false,
        error: "Request timed out. The WordPress server may be slow.",
      };
    }
    if (err.message.includes("ECONNREFUSED")) {
      return {
        ok: false,
        error: "Connection refused. The WordPress server may be down.",
      };
    }
  }
  return { ok: false, error: "Failed to connect to WordPress" };
}
