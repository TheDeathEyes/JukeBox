const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const yts = require('yt-search');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const MOT_DE_PASSE = "122333";

app.get('/player.html', (req, res, next) => {
  const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
  const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

  if (login === 'admin' && password === MOT_DE_PASSE) {
    return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Acces au Lecteur PC"');
  res.status(401).send('Acces refuse : Mot de passe requis.');
});

app.use(express.static('public'));

let queue = [];
let currentTrack = null;
const SEUIL_VOTES = 10;
let skipVotes = new Set();

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
    res.status(500).json({ error: 'Erreur de recherche' });
  }
});

function passerMusique() {
  if (queue.length > 0) {
    currentTrack = queue.shift();
  } else {
    currentTrack = null;
  }
  skipVotes.clear();
  io.emit('updateSkipVotes', 0);
  io.emit('updateState', { queue, currentTrack });
}

io.on('connection', (socket) => {
  const clientIp = socket.handshake.headers['x-forwarded-for'] 
    ? socket.handshake.headers['x-forwarded-for'].split(',')[0].trim() 
    : socket.handshake.address;

  socket.emit('updateState', { queue, currentTrack });
  socket.emit('updateSkipVotes', skipVotes.size);

  socket.on('addTrack', (track) => {
    const exists = queue.some(t => t.id === track.id) || (currentTrack && currentTrack.id === track.id);
    if (!exists) {
      queue.push(track);
      io.emit('updateState', { queue, currentTrack });
    }
  });

  socket.on('nextTrack', () => {
    passerMusique();
  });

  socket.on('voteSkip', () => {
    if (currentTrack && !skipVotes.has(clientIp)) {
      skipVotes.add(clientIp);
      io.emit('updateSkipVotes', skipVotes.size);
      
      if (skipVotes.size >= SEUIL_VOTES) {
        passerMusique();
      }
    }
  });

  socket.on('admin-trigger-flashmob', () => {
    io.emit('flashmob-start');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Boite a Musique en ligne sur le port ${PORT}`);
});
