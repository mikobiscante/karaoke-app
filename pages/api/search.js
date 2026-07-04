export default async function handler(req, res) {
  const { q } = req.query;
  const apiKey = process.env.YOUTUBE_API_KEY;
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(q + " karaoke")}&key=${apiKey}`;
  
  const response = await fetch(url);
  const data = await response.json();
  res.status(200).json(data.items);
}
