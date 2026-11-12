const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const yts = require('yt-search');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Sert le dossier "public" pour afficher les pages web
app.use(express.static('public'));

let queue = [];
let currentTrack = null;

// Route anti-veille pour les hébergeurs gratuits comme Render
app.get('/ping', (req, res) => res.send('pong'));

// Route de recherche YouTube (sans clé API)
app.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.json([]);
  try {
    const results = await yts(query);
    // On garde les 10 premières vidéos
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

// Gestion temps réel avec Socket.io
io.on('connection', (socket) => {
  // Met à jour l'utilisateur qui vient de se connecter
  socket.emit('updateState', { queue, currentTrack });

  // Ajout d'une musique à la file d'attente
  socket.on('addTrack', (track) => {
    // Éviter les doublons immédiats
    const exists = queue.some(t => t.id === track.id) || (currentTrack && currentTrack.id === track.id);
    if (!exists) {
      queue.push(track);
      io.emit('updateState', { queue, currentTrack });
    }
  });

  // Le lecteur passe au son suivant
  socket.on('nextTrack', () => {
    if (queue.length > 0) {
      currentTrack = queue.shift();
    } else {
      currentTrack = null;
    }
    io.emit('updateState', { queue, currentTrack });
  });
});

// Lancement du serveur sur le port imposé par l'hébergeur
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Boîte à Musique en ligne sur le port ${PORT}`);
});
