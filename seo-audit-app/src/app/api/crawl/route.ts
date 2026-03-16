import { NextResponse } from "next/server";
import { getRequiredSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { crawlSite } from "@/lib/crawler";
import { decrypt } from "@/lib/encryption";

export async function POST(req: Request) {
  const session = await getRequiredSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { wpConnectionId } = await req.json();
  if (!wpConnectionId) {
    return NextResponse.json(
      { error: "wpConnectionId is required" },
      { status: 400 }
    );
  }

  // Verify the connection belongs to this user
  const connection = await prisma.wPConnection.findFirst({
    where: { id: wpConnectionId, userId: session.userId },
  });
  if (!connection) {
    return NextResponse.json(
      { error: "WordPress connection not found" },
      { status: 404 }
    );
  }

  // Create audit record
  const audit = await prisma.audit.create({
    data: {
      userId: session.userId,
      wpConnectionId: connection.id,
      siteUrl: connection.siteUrl,
      status: "crawling",
    },
  });

  // Run the crawl (in a real production app, this would be a background job)
  try {
    const pages = await crawlSite(connection.siteUrl);

    // Store crawled data
    await prisma.crawledPageData.createMany({
      data: pages.map((page) => ({
        auditId: audit.id,
        url: page.url,
        rawData: JSON.parse(JSON.stringify(page)),
      })),
    });

    await prisma.audit.update({
      where: { id: audit.id },
      data: {
        status: "analyzing",
        totalPagesCrawled: pages.length,
      },
    });

    return NextResponse.json({
      auditId: audit.id,
      pagesCrawled: pages.length,
      status: "analyzing",
    });
  } catch (err) {
    await prisma.audit.update({
      where: { id: audit.id },
      data: { status: "failed" },
    });
    return NextResponse.json(
      { error: "Crawl failed. Please check the site URL and try again." },
      { status: 500 }
    );
  }
}
