const youtubedl = require('youtube-dl-exec');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

  try {
    const info = await youtubedl(`https://www.youtube.com/watch?v=${videoId}`, {
      dumpJson: true,
      noWarnings: true,
      noCallHome: true,
      noCheckCertificate: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true
    });

    if (!info || !info.formats) {
      return res.status(500).json({ error: 'No formats found' });
    }

    // Pilih format audio-only
    const formats = info.formats.filter(f => f.acodec !== 'none' && f.vcodec === 'none');
    formats.sort((a, b) => (b.abr || 0) - (a.abr || 0));
    const format = formats[0] || info.formats[0];

    if (!format || !format.url) {
      return res.status(500).json({ error: 'No audio format url found' });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, format.url);
  } catch (error) {
    console.error('stream-audio error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};
