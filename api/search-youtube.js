const ytSearch = require('yt-search');

module.exports = async (req, res) => {
  // Set CORS headers for Vercel
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const query = req.query.q || req.query.term;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter q' });
  }

  try {
    const result = await ytSearch(query);
    const videos = result.videos;
    
    if (videos && videos.length > 0) {
      // Return the first video ID
      return res.status(200).json({ videoId: videos[0].videoId });
    } else {
      return res.status(404).json({ error: 'Video not found' });
    }
  } catch (error) {
    console.error('yt-search error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
