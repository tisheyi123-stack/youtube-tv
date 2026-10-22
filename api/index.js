export const config = {
  runtime: 'edge',
};

const COMMON_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "fa,en-US;q=0.9,en;q=0.8"
};

export default async function handler(request) {
  const url = new URL(request.url);

  if (url.pathname.startsWith("/api/search")) {
    return handleSearch(url);
  }

  if (url.pathname.startsWith("/api/thumb")) {
    return handleThumbnail(url);
  }

  return new Response("Not found", { status: 404 });
}

async function handleSearch(url) {
  const q = url.searchParams.get("q") || "trending";
  try {
    const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
    const resp = await fetch(ytUrl, { headers: COMMON_HEADERS });
    const html = await resp.text();

    const m = html.match(/var ytInitialData = ({.*?});<\/script>/);
    if (!m) {
      return Response.json({ success: false, error: "Data not found", items: [] }, { status: 200 });
    }

    const data = JSON.parse(m[1]);
    const items = [];
    const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];

    for (const section of contents) {
      const itemSec = section?.itemSectionRenderer?.contents || [];
      for (const item of itemSec) {
        const v = item.videoRenderer;
        if (v && v.videoId) {
          const title = v.title?.runs?.map(r => r.text).join("") || "بدون عنوان";
          const author = v.ownerText?.runs?.[0]?.text || v.shortBylineText?.runs?.[0]?.text || "";
          const views = v.viewCountText?.simpleText || "";
          const duration = v.lengthText?.simpleText || "";
          items.push({
            id: v.videoId,
            title,
            author,
            views,
            duration,
            thumb: `/api/thumb?id=${v.videoId}`
          });
        }
      }
    }

    return Response.json({ success: true, items }, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60"
      }
    });
  } catch (err) {
    return Response.json({ success: false, error: err.message, items: [] }, { status: 500 });
  }
}

async function handleThumbnail(url) {
  const id = url.searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });

  const ytThumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  try {
    const resp = await fetch(ytThumb, { headers: COMMON_HEADERS });
    if (!resp.ok) return new Response("Thumb not found", { status: 404 });

    const headers = new Headers(resp.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800");

    return new Response(resp.body, {
      status: 200,
      headers
    });
  } catch (err) {
    return new Response("Error fetching thumb", { status: 502 });
  }
}
