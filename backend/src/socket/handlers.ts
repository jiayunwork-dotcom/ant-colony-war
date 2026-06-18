import { Server, Socket } from 'socket.io';
import { gameRoomManager } from '../services/GameRoomManager';
import { PlayerCommand } from '../../../shared/types';
import { COMMAND_TIME_LIMIT } from '../../../shared/constants';

export function setupSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    socket.on('create_room', (data: { playerName: string }, callback) => {
      try {
        const game = gameRoomManager.createRoom();
        const gameId = game.getState().id;
        const playerId = socket.id;

        const success = game.addPlayer(playerId, data.playerName);

        if (success) {
          socket.join(gameId);

          const state = game.getState();
          callback({
            success: true,
            gameId,
            playerId,
            state
          });

          io.to(gameId).emit('player_joined', {
            players: state.players
          });
        } else {
          callback({ success: false, error: 'Failed to add player' });
        }
      } catch (error) {
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

    socket.on('start_game', (data: { gameId: string }, callback) => {
      try {
        const game = gameRoomManager.getRoom(data.gameId);
        if (!game) {
          callback({ success: false, error: 'Game not found' });
          return;
        }

        const success = game.startGame();
        if (success) {
          const state = game.getState();
          io.to(data.gameId).emit('game_started', { state });

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
          game.removePlayer(socket.id);
          socket.leave(data.gameId);

          io.to(data.gameId).emit('player_left', {
            playerId: socket.id,
            players: game.getState().players
          });
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
          game.removePlayer(socket.id);

          io.to(gameId).emit('player_left', {
            playerId: socket.id,
            players: game.getState().players
          });

          if (game.getPlayerCount() === 0) {
            gameRoomManager.removeRoom(gameId);
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

    if (state.phase !== 'ended') {
      startTurnTimer(io, gameId);
    }
  }
}
