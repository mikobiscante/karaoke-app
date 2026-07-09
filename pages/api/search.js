export default async function handler(req, res) {
  const q = (req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "Missing query" });

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.status(500).json({ error: "Missing YOUTUBE_API_KEY" });

  const params = new URLSearchParams({
    part: "snippet",
    q: (q + " karaoke"),
    key,
    maxResults: "8",
    type: "video"
  });

  try {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: text });
    }
    const data = await r.json();
    const items = (data.items || []).map((it) => ({
      videoId: it.id.videoId,
      title: it.snippet.title,
      channelTitle: it.snippet.channelTitle,
      thumbnail: it.snippet.thumbnails?.mqdefault?.url || it.snippet.thumbnails?.default?.url
    }));
    res.status(200).json({ items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
