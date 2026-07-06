/**
 * Vercel Edge Function — Audio Stream Proxy
 *
 * Mengapa Edge Function?
 * - Tidak ada batas waktu eksekusi untuk streaming (berbeda dengan Serverless 10-60 detik)
 * - Audio datang dari domain kita sendiri (same-origin) → background playback di mobile berfungsi
 * - Forward Range requests → seeking berfungsi
 *
 * Cara kerja:
 * 1. app.js memanggil /api/get-audio-url?videoId=xxx untuk mendapat URL audio YouTube
 * 2. app.js set audioPlayer.src = /api/stream-audio?url=encodedYoutubeUrl
 * 3. Edge Function ini memproxy audio dari YouTube ke browser — same-origin
 */
export const config = { runtime: 'edge' };

export default async function handler(req) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Range',
      },
    });
  }

  const { searchParams } = new URL(req.url);
  const encodedUrl = searchParams.get('url');

  if (!encodedUrl) {
    return new Response('Missing url parameter', { status: 400 });
  }

  let targetUrl;
  try {
    targetUrl = decodeURIComponent(encodedUrl);
    // Validasi URL agar tidak bisa digunakan sebagai open proxy sembarangan
    const parsed = new URL(targetUrl);
    const allowedHosts = ['googlevideo.com', 'youtube.com', 'ytimg.com', 'ggpht.com'];
    if (!allowedHosts.some((h) => parsed.hostname.endsWith(h))) {
      return new Response('URL not allowed', { status: 403 });
    }
  } catch {
    return new Response('Invalid url parameter', { status: 400 });
  }

  try {
    // Forward Range header supaya seeking berfungsi
    const fetchHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      'Referer': 'https://www.youtube.com/',
      'Origin': 'https://www.youtube.com',
    };
    const range = req.headers.get('Range');
    if (range) fetchHeaders['Range'] = range;

    const audioRes = await fetch(targetUrl, { headers: fetchHeaders });

    // Susun response headers
    const responseHeaders = {
      'Content-Type': audioRes.headers.get('Content-Type') || 'audio/webm; codecs=opus',
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
      // Jangan cache di browser, URL YouTube sudah bisa expire
      'Cache-Control': 'no-store',
    };

    const contentLength = audioRes.headers.get('Content-Length');
    if (contentLength) responseHeaders['Content-Length'] = contentLength;

    const contentRange = audioRes.headers.get('Content-Range');
    if (contentRange) responseHeaders['Content-Range'] = contentRange;

    return new Response(audioRes.body, {
      status: audioRes.status,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response('Proxy error: ' + err.message, { status: 502 });
  }
}
