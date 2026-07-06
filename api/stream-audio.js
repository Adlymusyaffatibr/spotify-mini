const ytdl = require('@distube/ytdl-core');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

  try {
    const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`);
    
    // Pilih format audio terbaik (prioritas: opus/webm > m4a > yang lain)
    const formats = info.formats.filter(f => f.hasAudio && !f.hasVideo);
    formats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0));
    
    const format = formats[0] || ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
    
    if (!format || !format.url) {
      return res.status(500).json({ error: 'No audio format found' });
    }

    // Redirect langsung ke URL audio YouTube
    // Browser akan stream sendiri tanpa melewati Vercel (tidak ada timeout)
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, format.url);
  } catch (error) {
    console.error('stream-audio error:', error.message);
    return res.status(500).json({ error: error.message });
  }
};
