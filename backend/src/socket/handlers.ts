import { Server, Socket } from 'socket.io';
import { gameRoomManager } from '../services/GameRoomManager';
import { redisStore } from '../services/RedisStoreInstance';
import { aiManager } from '../services/AIManager';
import { PlayerCommand, AIDifficulty } from '../../../shared/types';
import { COMMAND_TIME_LIMIT } from '../../../shared/constants';

export function setupSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log('[Socket] Client connected:', socket.id, 'from', socket.handshake.address);

    socket.on('create_room', (data: { playerName: string }, callback) => {
      console.log('[Socket] create_room received. Socket:', socket.id, 'playerName:', data?.playerName);
      try {
        console.log('[Socket] Creating room...');
        const game = gameRoomManager.createRoom();
        const gameId = game.getState().id;
        const playerId = socket.id;
        console.log('[Socket] Room created, gameId:', gameId, 'phase:', game.getState().phase);

        console.log('[Socket] Adding player... playerId:', playerId, 'name:', data.playerName);
        const success = game.addPlayer(playerId, data.playerName);
        console.log('[Socket] addPlayer result:', success, 'playerCount:', game.getPlayerCount());

        if (success) {
          game.getState().hostId = playerId;

          socket.join(gameId);
          console.log('[Socket] Socket joined room:', gameId);

          const state = game.getState();
          console.log('[Socket] Calling callback with success, players:', state.players.length);
          callback({
            success: true,
            gameId,
            playerId,
            state
          });

          io.to(gameId).emit('player_joined', {
            players: state.players
          });
          console.log('[Socket] Broadcasted player_joined to room:', gameId);
        } else {
          console.log('[Socket] addPlayer failed, calling error callback');
          callback({ success: false, error: 'Failed to add player' });
        }
      } catch (error) {
        console.error('[Socket] create_room error:', error);
        callback({ success: false, error: (error as Error).message });
      }
    });

    socket.on('join_room', (data: { gameId: string; playerName: string }, callback) => {
      try {
        const game = gameRoomManager.getRoom(data.gameId);
        if (!game) {
          callback({ success: false, error: 'Game not found' });
          return;
        }

        const state = game.getState();
        if (state.phase !== 'waiting') {
          callback({ success: false, error: 'Game already started' });
          return;
        }

        if (state.players.length >= 6) {
          callback({ success: false, error: 'Room is full' });
          return;
        }

        const playerId = socket.id;
        const success = game.addPlayer(playerId, data.playerName);

        if (success) {
          socket.join(data.gameId);

          const state = game.getState();
          callback({
            success: true,
            gameId: data.gameId,
            playerId,
            state
          });

          io.to(data.gameId).emit('player_joined', {
            players: state.players
          });
        } else {
          callback({ success: false, error: 'Failed to join game' });
        }
      } catch (error) {
        callback({ success: false, error: (error as Error).message });
      }
    });

    socket.on('toggle_ready', (data: { gameId: string }, callback) => {
      try {
        const game = gameRoomManager.getRoom(data.gameId);
        if (!game) {
          callback({ success: false, error: 'Game not found' });
          return;
        }

        const player = game.getPlayer(socket.id);
        if (!player) {
          callback({ success: false, error: 'Player not found' });
          return;
        }

        player.lobbyReady = !player.lobbyReady;

        const state = game.getState();
        io.to(data.gameId).emit('lobby_ready_update', {
          players: state.players
        });

        callback({ success: true, lobbyReady: player.lobbyReady });
      } catch (error) {
        callback({ success: false, error: (error as Error).message });
      }
    });

    socket.on('start_game', (data: { gameId: string }, callback) => {
      try {
        const game = gameRoomManager.getRoom(data.gameId);
        if (!game) {
          callback({ success: false, error: 'Game not found' });
          return;
        }

        const state = game.getState();
        if (state.hostId !== socket.id) {
          callback({ success: false, error: 'Only the host can start the game' });
          return;
        }

        if (state.players.length < 4) {
          callback({ success: false, error: 'At least 4 players required' });
          return;
        }

        if (!state.players.every(p => p.lobbyReady)) {
          callback({ success: false, error: 'All players must be ready' });
          return;
        }

        const success = game.startGame();
        if (success) {
          const state = game.getState();
          io.to(data.gameId).emit('game_started', { state });

          aiManager.processAITurns(game, (command) => {
            io.to(data.gameId).emit('player_ready', {
              playerId: command.playerId,
              players: game.getState().players
            });

            if (game.allPlayersReady()) {
              processTurn(io, data.gameId);
            }
          });

          startTurnTimer(io, data.gameId);

          callback({ success: true, state });
        } else {
          callback({ success: false, error: 'Failed to start game' });
        }
      } catch (error) {
        callback({ success: false, error: (error as Error).message });
      }
    });

    socket.on('submit_command', (data: { gameId: string; command: PlayerCommand }, callback) => {
      try {
        const game = gameRoomManager.getRoom(data.gameId);
        if (!game) {
          callback({ success: false, error: 'Game not found' });
          return;
        }

        const success = game.submitCommand(data.command);
        if (success) {
          callback({ success: true });

          if (game.allPlayersReady()) {
            processTurn(io, data.gameId);
          } else {
            io.to(data.gameId).emit('player_ready', {
              playerId: data.command.playerId,
              players: game.getState().players
            });
          }
        } else {
          callback({ success: false, error: 'Failed to submit command' });
        }
      } catch (error) {
        callback({ success: false, error: (error as Error).message });
      }
    });

    socket.on('get_state', (data: { gameId: string }, callback) => {
      try {
        const game = gameRoomManager.getRoom(data.gameId);
        if (!game) {
          callback({ success: false, error: 'Game not found' });
          return;
        }

        callback({
          success: true,
          state: game.getState()
        });
      } catch (error) {
        callback({ success: false, error: (error as Error).message });
      }
    });

    socket.on('leave_room', (data: { gameId: string }, callback) => {
      try {
        const game = gameRoomManager.getRoom(data.gameId);
        if (game) {
          const state = game.getState();
          const wasHost = state.hostId === socket.id;

          game.removePlayer(socket.id);
          socket.leave(data.gameId);

          if (wasHost && state.players.length > 0) {
            state.hostId = state.players[0].id;
          }

          if (state.players.length === 0) {
            gameRoomManager.removeRoom(data.gameId);
          } else {
            io.to(data.gameId).emit('player_left', {
              playerId: socket.id,
              players: state.players,
              newHostId: wasHost ? state.hostId : undefined
            });
          }
        }

        callback({ success: true });
      } catch (error) {
        callback({ success: false, error: (error as Error).message });
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);

      for (const game of gameRoomManager.getAllRooms()) {
        if (game.getPlayer(socket.id)) {
          const gameId = game.getState().id;
          const wasHost = game.getState().hostId === socket.id;

          game.removePlayer(socket.id);

          if (wasHost && game.getState().players.length > 0) {
            game.getState().hostId = game.getState().players[0].id;
          }

          if (game.getPlayerCount() === 0) {
            gameRoomManager.removeRoom(gameId);
          } else {
            io.to(gameId).emit('player_left', {
              playerId: socket.id,
              players: game.getState().players,
              newHostId: wasHost ? game.getState().hostId : undefined
            });
          }
          break;
        }
      }
    });

    socket.on('chat_message', (data: { gameId: string; message: string }) => {
      const game = gameRoomManager.getRoom(data.gameId);
      if (!game) return;

      const player = game.getPlayer(socket.id);
      if (!player) return;

      io.to(data.gameId).emit('chat_message', {
        playerId: socket.id,
        playerName: player.name,
        message: data.message,
        timestamp: Date.now()
      });
    });

    socket.on('add_ai_player', (data: { gameId: string; difficulty: AIDifficulty }, callback) => {
      try {
        const game = gameRoomManager.getRoom(data.gameId);
        if (!game) {
          callback({ success: false, error: 'Game not found' });
          return;
        }

        const state = game.getState();
        if (state.hostId !== socket.id) {
          callback({ success: false, error: 'Only the host can add AI players' });
          return;
        }

        const success = aiManager.addAIPlayer(game, data.difficulty);
        if (success) {
          const state = game.getState();
          io.to(data.gameId).emit('player_joined', {
            players: state.players
          });
          callback({ success: true, state });
        } else {
          callback({ success: false, error: 'Failed to add AI player' });
        }
      } catch (error) {
        callback({ success: false, error: (error as Error).message });
      }
    });

    socket.on('remove_ai_player', (data: { gameId: string; playerId: string }, callback) => {
      try {
        const game = gameRoomManager.getRoom(data.gameId);
        if (!game) {
          callback({ success: false, error: 'Game not found' });
          return;
        }

        const state = game.getState();
        if (state.hostId !== socket.id) {
          callback({ success: false, error: 'Only the host can remove AI players' });
          return;
        }

        if (!aiManager.isAIPlayer(data.gameId, data.playerId)) {
          callback({ success: false, error: 'Player is not an AI' });
          return;
        }

        aiManager.removeAIPlayer(data.gameId, data.playerId);
        game.removePlayer(data.playerId);

        const newState = game.getState();
        io.to(data.gameId).emit('player_left', {
          playerId: data.playerId,
          players: newState.players
        });

        callback({ success: true, state: newState });
      } catch (error) {
        callback({ success: false, error: (error as Error).message });
      }
    });
  });

  function startTurnTimer(io: Server, gameId: string): void {
    const duration = COMMAND_TIME_LIMIT * 1000;

    gameRoomManager.startTurnTimer(
      gameId,
      () => {
        processTurn(io, gameId);
      },
      duration
    );

    setTimeout(() => {
      io.to(gameId).emit('time_warning', { remaining: 10 });
    }, duration - 10000);
  }

  function processTurn(io: Server, gameId: string): void {
    const game = gameRoomManager.getRoom(gameId);
    if (!game) return;

    gameRoomManager.stopTurnTimer(gameId);

    game.processTurn();
    const state = game.getState();

    io.to(gameId).emit('turn_processed', { state });

    if (state.phase === 'ended') {
      try {
        const replay = game.buildGameReplay();
        redisStore.saveReplay(replay).catch(err => {
          console.error('[Socket] Failed to save replay for game', gameId, err);
        });
      } catch (err) {
        console.error('[Socket] Failed to build replay for game', gameId, err);
      }
      aiManager.cleanupGame(gameId);
    } else {
      aiManager.processAITurns(game, (command) => {
        io.to(gameId).emit('player_ready', {
          playerId: command.playerId,
          players: game.getState().players
        });

        if (game.allPlayersReady()) {
          processTurn(io, gameId);
        }
      });
      startTurnTimer(io, gameId);
    }
  }
}
