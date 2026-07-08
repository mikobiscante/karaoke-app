// pages/api/suggest.js
export default async function handler(req, res) {
  const q = (req.query.q || "").trim();
  if (!q || q.length < 2) return res.status(400).json({ error: "Missing query" });

  try {
    const url = `https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(q + " karaoke")}`;
    const r = await fetch(url);
    const text = await r.text();

    // strip JSONP wrapper: window.google.ac.H(["query",[[suggestions]...]])
    const match = text.match(/\["([^"]+)",(\[.*?\]),\{"k":/);
    if (!match) return res.json({ suggestions: [] });

    const raw = JSON.parse(match[2]);
    const suggestions = raw.map((item) => item[0]);

    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
