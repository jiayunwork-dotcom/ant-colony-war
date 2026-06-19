import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { setupSocketHandlers } from './socket/handlers';
import { gameRoomManager } from './services/GameRoomManager';

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
