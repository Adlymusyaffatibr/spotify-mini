window.searchResults = [];
window.playlistSongs = [];
window.isPlaying = false;
window.likedSongs = new Set();
window.currentSongIndex = -1;
window.currentPlaylistSource = null;
window.currentPlayingType = null;
window.queue = [];
window.currentSong = null;
window.historyQueue = [];
window.currentLyrics = null;
window.lyricsSyncInterval = null;
window.currentPlaybackTime = 0;

document.addEventListener('DOMContentLoaded', () => {
  updateGreeting();
  setupKeyboard();
  setupLyricsScroll();
});

window.isUserScrolling = false;
window.scrollTimeout = null;

function setupLyricsScroll() {
  const scrollContainer = document.getElementById('lyricsScroll');
  if (!scrollContainer) return;
  
  const handleScroll = () => {
    window.isUserScrolling = true;
    if (window.scrollTimeout) clearTimeout(window.scrollTimeout);
    window.scrollTimeout = setTimeout(() => {
      window.isUserScrolling = false;
      const activeLine = document.querySelector('#lyricsContent p.active');
      if (activeLine && scrollContainer) {
        const pCenter = activeLine.offsetTop + activeLine.clientHeight / 2;
        const containerCenter = scrollContainer.clientHeight / 2;
        scrollContainer.scrollTo({
          top: pCenter - containerCenter,
          behavior: 'smooth'
        });
      }
    }, 2500);
  };
  
  scrollContainer.addEventListener('wheel', handleScroll, {passive: true});
  scrollContainer.addEventListener('touchmove', handleScroll, {passive: true});
  scrollContainer.addEventListener('mousedown', handleScroll, {passive: true});
}

function updateGreeting() {
  const hour = new Date().getHours();
  const el = document.getElementById('greeting');
  if (!el) return;
  if (hour >= 5 && hour < 12) el.textContent = 'Selamat Pagi ☀️';
  else if (hour >= 12 && hour < 15) el.textContent = 'Selamat Siang 🌤';
  else if (hour >= 15 && hour < 18) el.textContent = 'Selamat Sore 🌅';
  else el.textContent = 'Selamat Malam 🌙';
}

function setupKeyboard() {
  const input = document.getElementById('searchInput');
  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchSong();
    });
  }
  
  const audioPlayer = document.getElementById('audioPlayer');
  if (audioPlayer) {
    audioPlayer.addEventListener('ended', playNext);
  }

  window.addEventListener('message', (e) => {
    if (e.origin === "https://www.youtube.com") {
      try {
        const data = JSON.parse(e.data);
        if (data.event === "infoDelivery" && data.info) {
          if (data.info.playerState === 0) playNext();
          if (data.info.currentTime !== undefined) window.currentPlaybackTime = data.info.currentTime;
        }
      } catch(err) {}
    }
  });
}

function switchView(viewName, navEl) {
  // Hide all views
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  // Deactivate all nav items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show target view
  const target = document.getElementById('view-' + viewName);
  if (target) target.classList.add('active');

  // Activate nav item
  if (navEl) navEl.classList.add('active');

  // Close sidebar on mobile
  if (window.innerWidth <= 680) {
    document.getElementById('sidebar').classList.remove('open');
  }

  return false; // prevent anchor jump
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDuration(ms) {
  if (!ms) return '--:--';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
function renderSongItem(song, index, type) {
  const div = document.createElement('div');
  div.className = type === 'playlist' ? 'playlist-item' : 'song-item';
  div.style.animationDelay = `${index * 0.04}s`;
  div.onclick = (e) => {
    if (e.target.closest('.add-queue-btn')) return;
    if (e.target.closest('.artist-link')) return;
    if (type === 'search') playSongFromSearch(index);
    else if (type === 'playlist') playSongFromPlaylist(index);
    else if (type === 'artist') playSongFromArtist(index);
  };

  const artSrc = song.artworkUrl60 || song.artworkUrl100 || '';
  const artHtml = artSrc
    ? `<img src="${artSrc}" alt="art" />`
    : `<span>${getGenreEmoji(song.primaryGenreName)}</span>`;

  const numHtml = type === 'playlist'
    ? `<span class="playlist-num">${index + 1}</span>`
    : `<span class="song-num">${index + 1}</span>`;

  const artistId = song.artistId || '';
  const artistName = escapeHtml(song.artistName);
  const artistHtml = (artistId && type !== 'artist')
    ? `<span class="song-artist artist-link" onclick="openArtist(event, ${artistId}, '${artistName}')" title="Buka halaman ${artistName}">${artistName}</span>`
    : `<span class="song-artist">${artistName}</span>`;

  div.innerHTML = `
    ${numHtml}
    <div class="song-album-thumb">${artHtml}</div>
    <div class="song-info">
      <div class="song-name">${escapeHtml(song.trackName)}</div>
      ${artistHtml}
    </div>
    <button class="add-queue-btn" title="Tambah ke Antrean" onclick="addToQueue(event, ${index}, '${type}')">+</button>
    <span class="play-icon">▶</span>
    <span class="song-duration">${formatDuration(song.trackTimeMillis)}</span>
  `;
  return div;
}

function getGenreEmoji(genre) {
  if (!genre) return '🎵';
  const g = genre.toLowerCase();
  if (g.includes('pop')) return '🎤';
  if (g.includes('rock')) return '🎸';
  if (g.includes('hip') || g.includes('rap')) return '🎤';
  if (g.includes('r&b') || g.includes('soul')) return '🎷';
  if (g.includes('electronic') || g.includes('dance')) return '🎧';
  if (g.includes('jazz')) return '🎺';
  if (g.includes('classical')) return '🎻';
  if (g.includes('indie')) return '🌿';
  if (g.includes('metal')) return '🤘';
  return '🎵';
}

async function searchSong() {
  const input = document.getElementById('searchInput').value.trim();
  if (!input) return;

  const resultBox = document.getElementById('searchResult');
  resultBox.innerHTML = `<p class="loading-text">Mencari "<strong>${escapeHtml(input)}</strong>"<span class="loading-dots"></span></p>`;

  const btn = document.getElementById('searchBtn');
  btn.disabled = true;
  btn.textContent = 'Mencari...';

  try {
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(input)}&entity=song&limit=50`
    );
    const data = await response.json();

    btn.disabled = false;
    btn.textContent = 'Cari';

    if (!data.results || data.results.length === 0) {
      resultBox.innerHTML = `<p class="error-text">Lagu tidak ditemukan 😕</p>`;
      return;
    }

    window.searchResults = data.results;
    resultBox.innerHTML = '';
    data.results.forEach((song, index) => {
      resultBox.appendChild(renderSongItem(song, index, 'search'));
    });
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Cari';
    resultBox.innerHTML = `<p class="error-text">Gagal mencari lagu. Coba lagi! 🔌</p>`;
  }
}

function playSongData(song) {
  if (!song) return;
  if (window.currentSong) {
    if (!window.historyQueue) window.historyQueue = [];
    window.historyQueue.push(window.currentSong);
    if (window.historyQueue.length > 20) window.historyQueue.shift();
  }
  window.currentSong = song;
  playSong(song.previewUrl, song.trackName, song.artistName, song.artworkUrl60 || song.artworkUrl100, song.primaryGenreName);
  
  if (!window.queue) window.queue = [];
  if (window.queue.length < 5) {
    autoFillQueue();
  } else {
    renderQueue();
  }

  const lyricsView = document.getElementById('view-lyrics');
  if (lyricsView && lyricsView.classList.contains('active')) {
    loadLyricsForCurrentSong();
  }
}

function playSongFromSearch(index) {
  window.currentSongIndex = index;
  window.currentPlaylistSource = 'search';
  playSongData(window.searchResults[index]);
}

const MOODS = [
  { text: 'capek hidup tapi sok kuat',   emoji: '😭', query: 'sad emotional',     artClass: 'sad',   npEmoji: '😭' },
  { text: 'overthinking jam 2 pagi',     emoji: '🌙', query: 'lofi chill night',  artClass: 'lofi',  npEmoji: '🌙' },
  { text: 'lagi chill tapi hidup chaos', emoji: '😌', query: 'indie vibes relax', artClass: 'chill', npEmoji: '😌' },
  { text: 'emosi tapi males ribut',      emoji: '😤', query: 'rock angry energy', artClass: 'angry', npEmoji: '😤' },
  { text: 'santai tapi kosong',          emoji: '🌊', query: 'acoustic soft',     artClass: 'chill', npEmoji: '🌊' },
  { text: 'happy tapi ga ada alasan',    emoji: '🥳', query: 'upbeat pop happy',  artClass: 'happy', npEmoji: '🥳' },
  { text: 'galau sambil ngemil',         emoji: '🍜', query: 'rnb slow sad',      artClass: 'lofi',  npEmoji: '🍜' },
];

function scanMood() {
  const btn = document.getElementById('scanBtn');
  const heroArt = document.getElementById('moodHeroArt');
  const heroEmoji = document.getElementById('moodHeroEmoji');
  const moodText = document.getElementById('moodText');

  btn.disabled = true;
  btn.innerHTML = `<span class="btn-mood-icon">⏳</span> Scanning...`;

  // Emoji roll animation
  let rollCount = 0;
  const emojiList = ['😀','😢','😎','😤','🌊','🥳','🌙','😭','😌'];
  const rollInterval = setInterval(() => {
    heroEmoji.textContent = emojiList[rollCount % emojiList.length];
    rollCount++;
  }, 100);

  setTimeout(() => {
    clearInterval(rollInterval);

    const mood = MOODS[Math.floor(Math.random() * MOODS.length)];

    // Update hero
    heroEmoji.textContent = mood.emoji;
    moodText.textContent = mood.text;
    heroArt.className = `mood-hero-art ${mood.artClass}`;

    btn.disabled = false;
    btn.innerHTML = `<span class="btn-mood-icon">🔄</span> Scan Ulang`;

    generatePlaylist(mood.query);
  }, 1400);
}

async function generatePlaylist(query) {
  const playlistBox = document.getElementById('playlist');
  playlistBox.innerHTML = `<p class="loading-text">Ngebuatin playlist kamu<span class="loading-dots"></span></p>`;

  try {
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=8`
    );
    const data = await response.json();

    window.playlistSongs = data.results;

    playlistBox.innerHTML = `<div class="playlist-header">🎶 Playlist buat kamu — ${data.results.length} lagu</div>`;
    data.results.forEach((song, index) => {
      playlistBox.appendChild(renderSongItem(song, index, 'playlist'));
    });
  } catch (err) {
    playlistBox.innerHTML = `<p class="error-text">Gagal load playlist 😢</p>`;
  }
}

function playSongFromPlaylist(index) {
  window.currentSongIndex = index;
  window.currentPlaylistSource = 'playlist';
  playSongData(window.playlistSongs[index]);
}

function addToQueue(e, index, type) {
  if (e) e.stopPropagation();
  const list = type === 'search' ? window.searchResults : window.playlistSongs;
  if (list && list[index]) {
    const song = { ...list[index], isExplicit: true };
    window.queue.push(song);
    renderQueue();
  }
}

const RANDOM_TERMS = ['pop', 'indie', 'rock', 'chill', 'lofi', 'acoustic', 'viral', 'hits', 'indonesia', 'band', 'rnb', 'jazz', 'kpop', 'jpop', 'anime', 'tiktok', 'trending', 'galau', 'senja', 'koplo'];

async function autoFillQueue() {
  if (!window.queue) window.queue = [];
  if (window.queue.length >= 10) return;
  
  const term = RANDOM_TERMS[Math.floor(Math.random() * RANDOM_TERMS.length)];
  try {
    const response = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&limit=15`);
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const shuffled = data.results.sort(() => 0.5 - Math.random());
      for (const song of shuffled) {
        if (window.queue.length >= 10) break;
        if (!window.queue.find(s => s.trackId === song.trackId) && (!window.currentSong || window.currentSong.trackId !== song.trackId)) {
          window.queue.push(song);
        }
      }
      renderQueue();
    }
  } catch(e) {
    console.error('Failed to auto-fill queue', e);
  }
}

function playNext() {
  if (window.queue.length > 0) {
    playSongData(window.queue.shift());
    return;
  }
  autoFillQueue().then(() => {
    if (window.queue.length > 0) {
      playSongData(window.queue.shift());
    }
  });
}

function playPrev() {
  if (window.historyQueue && window.historyQueue.length > 0) {
    if (window.currentSong) {
      window.queue.unshift(window.currentSong);
    }
    const prevSong = window.historyQueue.pop();
    window.currentSong = prevSong;
    playSong(prevSong.previewUrl, prevSong.trackName, prevSong.artistName, prevSong.artworkUrl60 || prevSong.artworkUrl100, prevSong.primaryGenreName);
    renderQueue();
  }
}

function toggleQueue() {
  const q = document.getElementById('queueSidebar');
  if (q) q.classList.toggle('open');
  renderQueue();
}

function renderQueue() {
  const npBox = document.getElementById('queueNowPlaying');
  const nextBox = document.getElementById('queueNextList');
  if (!npBox || !nextBox) return;

  if (window.currentSong) {
    npBox.innerHTML = renderQueueItem(window.currentSong, -1);
  } else {
    npBox.innerHTML = '<p style="font-size: 12px; color: var(--text-muted); padding: 0 8px;">Belum ada lagu yang diputar</p>';
  }

  let html = '';
  window.queue.forEach((song, i) => {
    html += renderQueueItem(song, i, song.isExplicit || false);
  });

  if (html) {
    nextBox.innerHTML = html;
  } else {
    nextBox.innerHTML = '<p style="font-size: 12px; color: var(--text-muted); padding: 0 8px;">Antrean kosong</p>';
  }
}

function renderQueueItem(song, index, isExplicit = false) {
  const artSrc = song.artworkUrl60 || song.artworkUrl100 || '';
  const artHtml = artSrc
    ? `<img src="${artSrc}" alt="art" />`
    : `<span>${getGenreEmoji(song.primaryGenreName)}</span>`;
  
  return `
    <div class="queue-item" style="${isExplicit ? 'border-left: 2px solid var(--sp-green); padding-left: 6px;' : ''}">
      <div class="queue-thumb">${artHtml}</div>
      <div class="queue-info">
        <div class="queue-title">${escapeHtml(song.trackName)}</div>
        <div class="queue-artist">${escapeHtml(song.artistName)}</div>
      </div>
    </div>
  `;
}

async function getYouTubeVideoId(query) {
  try {
    const response = await fetch(`/api/search-youtube?q=${encodeURIComponent(query)}`);
    if (response.ok) {
      const data = await response.json();
      return data.videoId || null;
    }
  } catch (e) {
    console.warn('YouTube search failed:', e);
  }
  return null;
}

async function playSong(previewUrl, trackName, artistName, artworkUrl, genre) {
  const audioPlayer = document.getElementById('audioPlayer');
  const youtubePlayer = document.getElementById('youtubePlayer');
  const nowPlayingInline = document.getElementById('nowPlayingBar');
  const nowPlayingText = document.getElementById('nowPlaying');

  // Reset audio
  audioPlayer.pause();
  audioPlayer.src = '';
  audioPlayer.style.display = 'none';

  // Reset YouTube
  youtubePlayer.src = '';
  youtubePlayer.style.display = 'none';
  window.currentPlaybackTime = 0;

  // Show player section
  const playerSection = document.getElementById('playerSection');
  if (playerSection) playerSection.style.display = 'block';

  // Update inline bar & bottom bar
  nowPlayingInline.classList.add('visible');
  if (nowPlayingText) nowPlayingText.textContent = `⏳ Mencari "${trackName}"...`;
  updateNowPlayingBar(trackName, artistName, artworkUrl, genre);

  // Coba YouTube via Invidious API
  // Using quotes around trackName and artistName ensures YouTube search 
  // is stricter and doesn't return a completely different popular song
  const safeTrackName = trackName.replace(/"/g, '');
  const safeArtistName = artistName.replace(/"/g, '');
  const query = `"${safeTrackName}" "${safeArtistName}"`;
  const videoId = await getYouTubeVideoId(query);

  if (videoId) {
    window.currentPlayingType = 'youtube';
    if (nowPlayingText) nowPlayingText.textContent = `▶ ${trackName} — ${artistName}`;
    youtubePlayer.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&enablejsapi=1`;
    youtubePlayer.style.display = 'block';
    setPlayState(true);
    
    setTimeout(() => {
      const vol = document.getElementById('volumeSlider') ? document.getElementById('volumeSlider').value : 80;
      if (youtubePlayer.contentWindow) {
        youtubePlayer.contentWindow.postMessage(JSON.stringify({event: "command", func: "setVolume", args: [vol]}), '*');
        youtubePlayer.contentWindow.postMessage(JSON.stringify({event: 'listening', id: 1}), '*');
      }
    }, 2000);
  } else {
    window.currentPlayingType = 'audio';
    // Fallback: iTunes preview (30 detik)
    if (!previewUrl || previewUrl === 'undefined') {
      if (nowPlayingText) nowPlayingText.textContent = `Tidak bisa memutar "${trackName}" 😔`;
      nowPlayingInline.classList.remove('visible');
      return;
    }
    if (nowPlayingText) nowPlayingText.textContent = `▶ ${trackName} — ${artistName} (Preview 30s)`;
    audioPlayer.src = previewUrl;
    audioPlayer.style.display = 'block';
    audioPlayer.play();
    setPlayState(true);
  }
}

function updateNowPlayingBar(trackName, artistName, artworkUrl, genre) {
  const npTitle = document.getElementById('npTitle');
  const npArtist = document.getElementById('npArtist');
  const npAlbumArt = document.getElementById('npAlbumArt');

  if (npTitle) npTitle.textContent = trackName;
  if (npArtist) npArtist.textContent = artistName;

  if (npAlbumArt) {
    if (artworkUrl) {
      npAlbumArt.innerHTML = `<img src="${artworkUrl}" alt="${escapeHtml(trackName)}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;" />`;
    } else {
      npAlbumArt.innerHTML = `<span id="npEmoji">${getGenreEmoji(genre)}</span>`;
    }
  }

  // Update Media Session API for background playback & lockscreen controls
  if ('mediaSession' in navigator) {
    const art = artworkUrl ? artworkUrl.replace('60x60', '512x512').replace('100x100', '512x512') : 'https://via.placeholder.com/512';
    navigator.mediaSession.metadata = new window.MediaMetadata({
      title: trackName,
      artist: artistName,
      album: 'MoodTunes',
      artwork: [
        { src: art, sizes: '512x512', type: 'image/jpeg' }
      ]
    });

    navigator.mediaSession.setActionHandler('play', togglePlay);
    navigator.mediaSession.setActionHandler('pause', togglePlay);
    navigator.mediaSession.setActionHandler('previoustrack', playPrev);
    navigator.mediaSession.setActionHandler('nexttrack', playNext);
  }
}

function setPlayState(playing) {
  window.isPlaying = playing;
  const btn = document.getElementById('npPlayBtn');
  if (btn) btn.textContent = playing ? '⏸' : '▶';
}

function togglePlay() {
  const audio = document.getElementById('audioPlayer');
  const yt = document.getElementById('youtubePlayer');

  if (window.currentPlayingType === 'youtube' && yt && yt.contentWindow) {
    if (window.isPlaying) {
      yt.contentWindow.postMessage(JSON.stringify({event: "command", func: "pauseVideo", args: ""}), '*');
      setPlayState(false);
    } else {
      yt.contentWindow.postMessage(JSON.stringify({event: "command", func: "playVideo", args: ""}), '*');
      setPlayState(true);
    }
  } else if (window.currentPlayingType === 'audio' && audio && audio.src) {
    if (window.isPlaying) {
      audio.pause();
      setPlayState(false);
    } else {
      audio.play();
      setPlayState(true);
    }
  }
}

function setVolume(val) {
  const audio = document.getElementById('audioPlayer');
  if (audio) audio.volume = val / 100;
  
  const yt = document.getElementById('youtubePlayer');
  if (yt && yt.contentWindow && window.currentPlayingType === 'youtube') {
    yt.contentWindow.postMessage(JSON.stringify({event: "command", func: "setVolume", args: [val]}), '*');
  }
}

function toggleLike() {
  const heart = document.getElementById('npHeart');
  const title = document.getElementById('npTitle')?.textContent;
  if (!title || title === 'Pilih lagu dulu') return;

  if (window.likedSongs.has(title)) {
    window.likedSongs.delete(title);
    heart.classList.remove('liked');
  } else {
    window.likedSongs.add(title);
    heart.classList.add('liked');
    // Micro animation
    heart.style.transform = 'scale(1.4)';
    setTimeout(() => { heart.style.transform = ''; }, 200);
  }
}

function toggleLyrics() {
  const btn = document.getElementById('btnLyrics');
  if (btn.classList.contains('active')) {
    btn.classList.remove('active');
    switchView('home', document.getElementById('nav-home'));
  } else {
    btn.classList.add('active');
    switchView('lyrics', null);
    loadLyricsForCurrentSong();
  }
}

async function loadLyricsForCurrentSong() {
  const content = document.getElementById('lyricsContent');
  const title = document.getElementById('lyricsTitle');
  const artist = document.getElementById('lyricsArtist');
  const art = document.getElementById('lyricsArt');

  if (!window.currentSong) {
    content.innerHTML = '<p class="lyrics-placeholder" style="font-size: 20px; color: var(--text-muted);">Putar lagu untuk melihat lirik 🎤</p>';
    return;
  }

  title.textContent = window.currentSong.trackName;
  artist.textContent = window.currentSong.artistName;
  
  const artSrc = window.currentSong.artworkUrl100 || window.currentSong.artworkUrl60;
  if (artSrc) {
    art.innerHTML = `<img src="${artSrc}" alt="art" style="width:100%; height:100%; object-fit:cover;" />`;
  } else {
    art.innerHTML = `<span>🎵</span>`;
  }

  content.innerHTML = '<p class="loading-text">Mencari lirik...<span class="loading-dots"></span></p>';

  try {
    const url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(window.currentSong.trackName)}&artist_name=${encodeURIComponent(window.currentSong.artistName)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Not found');
    const data = await res.json();
    
    if (data.syncedLyrics) {
      window.currentLyrics = parseLRC(data.syncedLyrics);
      renderSyncedLyrics();
    } else if (data.plainLyrics) {
      window.currentLyrics = null;
      content.innerHTML = `<p style="font-size: 24px; white-space: pre-wrap; opacity: 1;">${escapeHtml(data.plainLyrics)}</p>`;
    } else {
      throw new Error('No lyrics');
    }
  } catch (e) {
    content.innerHTML = `<p class="error-text" style="font-size: 20px;">Yah, lirik untuk lagu ini belum tersedia 😢</p>`;
    window.currentLyrics = null;
  }
}

function parseLRC(lrc) {
  const lines = lrc.split('\n');
  const parsed = [];
  const regex = /^\[(\d{2}):(\d{2}(?:\.\d{2,3})?)\](.*)/;
  for (const line of lines) {
    const match = line.match(regex);
    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseFloat(match[2]);
      const text = match[3].trim() || '♪';
      parsed.push({ time: min * 60 + sec, text });
    }
  }
  return parsed;
}

function renderSyncedLyrics() {
  const content = document.getElementById('lyricsContent');
  if (!window.currentLyrics) return;
  
  let html = '';
  window.currentLyrics.forEach((line, index) => {
    html += `<p id="lyric-line-${index}" onclick="seekTo(${line.time})">${escapeHtml(line.text)}</p>`;
  });
  content.innerHTML = html;
  
  if (!window.lyricsSyncInterval) {
    window.lyricsSyncInterval = setInterval(syncLyricsLoop, 100);
  }
}

function syncLyricsLoop() {
  if (!window.currentLyrics || !document.getElementById('view-lyrics').classList.contains('active')) return;
  
  let currentTime = 0;
  if (window.currentPlayingType === 'audio') {
    const audio = document.getElementById('audioPlayer');
    if (audio) currentTime = audio.currentTime;
  } else if (window.currentPlayingType === 'youtube') {
    currentTime = window.currentPlaybackTime || 0;
  }
  
  let activeIndex = -1;
  for (let i = 0; i < window.currentLyrics.length; i++) {
    if (currentTime >= window.currentLyrics[i].time - 0.3) {
      activeIndex = i;
    } else {
      break;
    }
  }
  
  if (activeIndex !== -1) {
    const allLines = document.querySelectorAll('#lyricsContent p');
    allLines.forEach((p, i) => {
      if (i === activeIndex) {
        if (!p.classList.contains('active')) {
          p.classList.add('active');
          const scrollContainer = document.getElementById('lyricsScroll');
          if (scrollContainer && !window.isUserScrolling) {
            const pCenter = p.offsetTop + p.clientHeight / 2;
            const containerCenter = scrollContainer.clientHeight / 2;
            scrollContainer.scrollTo({
              top: pCenter - containerCenter,
              behavior: 'smooth'
            });
          }
        }
      } else {
        p.classList.remove('active');
      }
    });
  }
}

function seekTo(time) {
  window.isUserScrolling = false;
  if (window.scrollTimeout) {
    clearTimeout(window.scrollTimeout);
    window.scrollTimeout = null;
  }

  if (window.currentPlayingType === 'audio') {
    const audio = document.getElementById('audioPlayer');
    if (audio) audio.currentTime = time;
  } else if (window.currentPlayingType === 'youtube') {
    const yt = document.getElementById('youtubePlayer');
    if (yt && yt.contentWindow) {
      yt.contentWindow.postMessage(JSON.stringify({event: "command", func: "seekTo", args: [time, true]}), '*');
    }
  }
}

// ============================================================
//  ARTIST VIEW
// ============================================================
window.artistSongs = [];

async function openArtist(event, artistId, artistName) {
  if (event) event.stopPropagation();

  // Deactivate lyrics button if active
  const lyricsBtn = document.getElementById('btnLyrics');
  if (lyricsBtn) lyricsBtn.classList.remove('active');

  // Switch to artist view using the standard switchView helper
  switchView('artist', null);

  // Reset UI
  document.getElementById('artistNameTitle').textContent = artistName;
  document.getElementById('artistStats').textContent = 'Memuat...';
  document.getElementById('artistAvatar').innerHTML = '<span>👤</span>';
  document.getElementById('artistHeroBg').style.backgroundImage = '';
  document.getElementById('artistTopTracks').innerHTML =
    '<p class="loading-text">Memuat lagu populer<span class="loading-dots"></span></p>';

  try {
    let songs = [];
    let artworkUrl = '';

    // Try lookup by artistId first
    if (artistId) {
      const res = await fetch(
        `https://itunes.apple.com/lookup?id=${artistId}&entity=song&limit=20&sort=popular`
      );
      const data = await res.json();
      // results[0] is the artist, the rest are songs
      songs = data.results ? data.results.filter(r => r.wrapperType === 'track') : [];
      // Get artwork from first song
      if (songs.length > 0) {
        artworkUrl = (songs[0].artworkUrl100 || songs[0].artworkUrl60 || '').replace('100x100', '400x400');
      }
    }

    // Fallback: search by name if no songs found
    if (songs.length === 0) {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(artistName)}&entity=song&attribute=artistTerm&limit=20`
      );
      const data = await res.json();
      songs = data.results || [];
      if (songs.length > 0) {
        artworkUrl = (songs[0].artworkUrl100 || songs[0].artworkUrl60 || '').replace('100x100', '400x400');
      }
    }

    window.artistSongs = songs;

    // Update hero background with album art (blurred)
    if (artworkUrl) {
      document.getElementById('artistHeroBg').style.backgroundImage = `url('${artworkUrl}')`;
      document.getElementById('artistAvatar').innerHTML = `<img src="${artworkUrl}" alt="${escapeHtml(artistName)}" />`;
    }

    // Rough listener count estimate from trackCount (just for show)
    const trackCount = songs.length;
    document.getElementById('artistStats').textContent =
      `${trackCount} lagu tersedia · iTunes`;

    // Render song list
    renderArtistSongs(songs);

  } catch (err) {
    document.getElementById('artistTopTracks').innerHTML =
      '<p class="error-text">Gagal memuat lagu artis 😢</p>';
    document.getElementById('artistStats').textContent = '';
  }
}

function renderArtistSongs(songs) {
  const container = document.getElementById('artistTopTracks');
  container.innerHTML = '';

  if (!songs || songs.length === 0) {
    container.innerHTML = '<p class="error-text">Tidak ada lagu ditemukan 😕</p>';
    return;
  }

  songs.forEach((song, index) => {
    container.appendChild(renderSongItem(song, index, 'artist'));
  });
}

function playSongFromArtist(index) {
  window.currentSongIndex = index;
  window.currentPlaylistSource = 'artist';
  playSongData(window.artistSongs[index]);
}

function playArtistTopTracks() {
  if (!window.artistSongs || window.artistSongs.length === 0) return;
  // Add rest to queue then play first
  window.queue = [...window.artistSongs.slice(1)];
  playSongFromArtist(0);
}

