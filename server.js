const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const yts = require('yt-search');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const MOT_DE_PASSE = "soiree2026";

app.get('/player.html', (req, res, next) => {
  const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
  const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

  if (login === 'admin' && password === MOT_DE_PASSE) {
    return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Accès au Lecteur PC"');
  res.status(401).send('Accès refusé : Mot de passe requis.');
});

app.use(express.static('public'));

let queue = [];
let currentTrack = null;

app.get('/ping', (req, res) => res.send('pong'));

app.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.json([]);
  try {
    const results = await yts(query);
    const videos = results.videos.slice(0, 30).map(v => ({
      id: v.videoId,
      title: v.title,
      author: v.author.name,
      duration: v.timestamp,
      thumbnail: v.thumbnail
    }));
    res.json(videos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur de recherche' });
  }
});

io.on('connection', (socket) => {
  socket.emit('updateState', { queue, currentTrack });

  socket.on('addTrack', (track) => {
    const exists = queue.some(t => t.id === track.id) || (currentTrack && currentTrack.id === track.id);
    if (!exists) {
      queue.push(track);
      io.emit('updateState', { queue, currentTrack });
    }
  });

  socket.on('nextTrack', () => {
    if (queue.length > 0) {
      currentTrack = queue.shift();
    } else {
      currentTrack = null;
    }
    io.emit('updateState', { queue, currentTrack });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎵 Boîte à Musique en ligne sur le port ${PORT}`);
});
