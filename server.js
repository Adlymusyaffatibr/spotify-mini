const express = require('express');
const cors = require('cors');
const youtubedl = require('youtube-dl-exec');
const ytSearch = require('yt-search');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname, '.')));

app.get('/api/search-youtube', async (req, res) => {
  const query = req.query.q || req.query.term;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter q' });
  }

  try {
    const result = await ytSearch(query);
    const videos = result.videos;
    
    if (videos && videos.length > 0) {
      return res.status(200).json({ videoId: videos[0].videoId });
    } else {
      return res.status(404).json({ error: 'Video not found' });
    }
  } catch (error) {
    console.error('yt-search error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/get-audio-url', async (req, res) => {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

  try {
    const output = await youtubedl(`https://www.youtube.com/watch?v=${videoId}`, {
      dumpJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: ['referer:youtube.com', 'user-agent:googlebot'],
      format: 'bestaudio'
    });
    return res.status(200).json({ url: output.url });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Proxy stream API to bypass IP binding or CORS issues from raw URLs
app.get('/api/stream-audio', async (req, res) => {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).send('Missing videoId');

  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const subprocess = youtubedl.exec(url, {
      output: '-',
      format: 'bestaudio',
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: ['referer:youtube.com', 'user-agent:googlebot']
    });
    
    res.setHeader('Content-Type', 'audio/webm');
    subprocess.stdout.pipe(res);

    subprocess.on('error', (err) => {
      console.error('Stream error:', err.message);
      if (!res.headersSent) res.status(500).send('Stream error');
    });
    
    req.on('close', () => {
      try { subprocess.kill('SIGINT'); } catch (e) {}
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
  console.log('Buka link di atas pada browser komputer, atau akses menggunakan IP Address komputermu di HP (contoh: http://192.168.1.5:3000)');
});
