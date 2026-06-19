import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { setupSocketHandlers } from './socket/handlers';
import { gameRoomManager } from './services/GameRoomManager';
import { redisStore } from './services/RedisStoreInstance';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/', (_req, res) => {
  res.json({
    name: 'Ant Colony War Backend',
    version: '1.0.0',
    status: 'running',
    environment: NODE_ENV
  });
});

app.get('/api/rooms', (_req, res) => {
  const rooms = gameRoomManager.getAvailableRooms();
  res.json({ success: true, rooms });
});

app.get('/api/replays', async (_req, res) => {
  try {
    const summaries = await redisStore.getRecentGames();
    res.json({ success: true, replays: summaries });
  } catch (error) {
    console.error('[API] Error fetching replays:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch replays' });
  }
});

app.get('/api/replays/:id', async (req, res) => {
  try {
    const replay = await redisStore.getReplayById(req.params.id);
    if (!replay) {
      res.status(404).json({ success: false, error: 'Replay not found' });
      return;
    }
    const sortedReplay = {
      ...replay,
      turns: [...replay.turns].sort((a, b) => a.turn - b.turn)
    };
    res.json({ success: true, replay: sortedReplay });
  } catch (error) {
    console.error('[API] Error fetching replay:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch replay' });
  }
});

app.get('/api/replays/:id/ai', async (req, res) => {
  try {
    const replayWithAI = await redisStore.getReplayWithAIById(req.params.id);
    if (!replayWithAI) {
      res.status(404).json({ success: false, error: 'AI replay data not found or expired' });
      return;
    }
    const sortedReplay = {
      ...replayWithAI,
      turns: [...replayWithAI.turns].sort((a, b) => a.turn - b.turn),
      aiReplayData: replayWithAI.aiReplayData.map(aiData => ({
        ...aiData,
        decisions: [...aiData.decisions].sort((a, b) => a.turn - b.turn)
      }))
    };
    res.json({ success: true, replay: sortedReplay });
  } catch (error) {
    console.error('[API] Error fetching AI replay:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch AI replay' });
  }
});

app.get('/api/replays/:id/ai/valid', async (req, res) => {
  try {
    const isValid = await redisStore.checkAIReplayValid(req.params.id);
    res.json({ success: true, valid: isValid });
  } catch (error) {
    console.error('[API] Error checking AI replay validity:', error);
    res.status(500).json({ success: false, error: 'Failed to check AI replay validity' });
  }
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

setupSocketHandlers(io);

server.listen(PORT, () => {
  console.log(`🚀 Ant Colony War server running on port ${PORT}`);
  console.log(`  Environment: ${NODE_ENV}`);
  console.log(`  Health check: http://localhost:${PORT}/health`);
  console.log(`  Socket.io: ws://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { app, server, io };
