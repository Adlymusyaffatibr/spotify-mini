const play = require('play-dl');

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
    const result = await play.search(query, { limit: 1 });
    
    if (result && result.length > 0) {
      return res.status(200).json({ videoId: result[0].id });
    } else {
      return res.status(404).json({ error: 'Video not found' });
    }
  } catch (error) {
    console.error('play-dl search error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
