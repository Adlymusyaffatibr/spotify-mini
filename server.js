const express = require('express');
const cors = require('cors');
const ytdl = require('@distube/ytdl-core');
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
    const info = await ytdl.getInfo(videoId);
    const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
    return res.status(200).json({ url: format.url });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Proxy stream API to bypass IP binding or CORS issues from raw URLs
app.get('/api/stream-audio', async (req, res) => {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).send('Missing videoId');

  try {
    const stream = ytdl(videoId, { filter: 'audioonly', quality: 'highestaudio' });
    res.setHeader('Content-Type', 'audio/webm');
    
    stream.on('error', (err) => {
      console.error('Stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).send('Stream error');
      } else {
        res.end();
      }
    });

    stream.pipe(res);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
  console.log('Buka link di atas pada browser komputer, atau akses menggunakan IP Address komputermu di HP (contoh: http://192.168.1.5:3000)');
});
