import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { io, Socket } from 'socket.io-client'
import type {
  GameState,
  Player,
  PlayerCommand,
  HexCoord,
  EventLogEntry,
  MoveCommand,
  AntType,
  FacilityType,
  MutationType
} from '@shared/types'

export const useGameStore = defineStore('game', () => {
  const socket = ref<Socket | null>(null)
  const gameId = ref<string>('')
  const playerId = ref<string>('')
  const gameState = ref<GameState | null>(null)
  const isConnected = ref(false)
  const selectedAnts = ref<string[]>([])
  const moveTarget = ref<HexCoord | null>(null)
  const isHost = ref(false)

  const currentPlayer = computed(() => {
    if (!gameState.value || !playerId.value) return null
    return gameState.value.players.find(p => p.id === playerId.value) || null
  })

  const otherPlayers = computed(() => {
    if (!gameState.value) return []
    return gameState.value.players.filter(p => p.id !== playerId.value)
  })

  const isMyTurn = computed(() => {
    if (!gameState.value || !currentPlayer.value) return false
    return gameState.value.phase === 'command' && !currentPlayer.value.isEliminated
  })

  const timeRemaining = computed(() => {
    if (!gameState.value) return 0
    return Math.max(0, Math.ceil((gameState.value.phaseEndTime - Date.now()) / 1000))
  })

  const sortedEventLog = computed(() => {
    if (!gameState.value) return [] as EventLogEntry[]
    return [...gameState.value.eventLog].reverse()
  })

  function connect() {
    if (socket.value && isConnected.value) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80')

    const socketUrl = `${protocol}//${host}:${port}`
    socket.value = io(socketUrl, {
      transports: ['websocket', 'polling']
    })

    socket.value.on('connect', () => {
      isConnected.value = true
      console.log('Connected to server')
    })

    socket.value.on('disconnect', () => {
      isConnected.value = false
      console.log('Disconnected from server')
    })

    socket.value.on('player_joined', (data: { players: Player[] }) => {
      if (gameState.value) {
        gameState.value.players = data.players
      }
    })

    socket.value.on('player_left', (data: { playerId: string; players: Player[] }) => {
      if (gameState.value) {
        gameState.value.players = data.players
      }
    })

    socket.value.on('game_started', (data: { state: GameState }) => {
      gameState.value = data.state
    })

    socket.value.on('turn_processed', (data: { state: GameState }) => {
      gameState.value = data.state
      selectedAnts.value = []
      moveTarget.value = null
    })

    socket.value.on('player_ready', (data: { playerId: string; players: Player[] }) => {
      if (gameState.value) {
        gameState.value.players = data.players
      }
    })

    socket.value.on('time_warning', (data: { remaining: number }) => {
      console.log('Time warning:', data.remaining, 'seconds')
    })
  }

  function createRoom(playerName: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!socket.value) {
        resolve({ success: false, error: 'Not connected' })
        return
      }

      socket.value.emit('create_room', { playerName }, (response: any) => {
        if (response.success) {
          gameId.value = response.gameId
          playerId.value = response.playerId
          gameState.value = response.state
          isHost.value = true
        }
        resolve(response)
      })
    })
  }

  function joinRoom(roomId: string, playerName: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!socket.value) {
        resolve({ success: false, error: 'Not connected' })
        return
      }

      socket.value.emit('join_room', { gameId: roomId, playerName }, (response: any) => {
        if (response.success) {
          gameId.value = response.gameId
          playerId.value = response.playerId
          gameState.value = response.state
          isHost.value = false
        }
        resolve(response)
      })
    })
  }

  function startGame(): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!socket.value || !gameId.value) {
        resolve({ success: false, error: 'Not connected or no game' })
        return
      }

      socket.value.emit('start_game', { gameId: gameId.value }, (response: any) => {
        if (response.success && response.state) {
          gameState.value = response.state
        }
        resolve(response)
      })
    })
  }

  function submitCommand(command: Partial<PlayerCommand>): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      if (!socket.value || !gameId.value || !playerId.value) {
        resolve({ success: false, error: 'Not connected or no game' })
        return
      }

      const fullCommand: PlayerCommand = {
        playerId: playerId.value,
        moveCommands: command.moveCommands || [],
        buildCommands: command.buildCommands || [],
        produceCommands: command.produceCommands || [],
        upgradeCommands: command.upgradeCommands || [],
        chooseMutation: command.chooseMutation
      }

      socket.value.emit('submit_command', {
        gameId: gameId.value,
        command: fullCommand
      }, (response: any) => {
        resolve(response)
      })
    })
  }

  function moveAnts(target: HexCoord): Promise<{ success: boolean; error?: string }> {
    const moveCommands: MoveCommand[] = selectedAnts.value.map(antId => ({
      antId,
      target: { ...target }
    }))

    return submitCommand({ moveCommands })
  }

  function produceAnts(type: AntType, count: number): Promise<{ success: boolean; error?: string }> {
    return submitCommand({
      produceCommands: [{ antType: type, count }]
    })
  }

  function upgradeFacility(facilityType: FacilityType): Promise<{ success: boolean; error?: string }> {
    return submitCommand({
      upgradeCommands: [{ facilityType }]
    })
  }

  function chooseMutation(mutation: MutationType): Promise<{ success: boolean; error?: string }> {
    return submitCommand({ chooseMutation: mutation })
  }

  function selectAnt(antId: string, multiSelect: boolean = false) {
    if (multiSelect) {
      const index = selectedAnts.value.indexOf(antId)
      if (index > -1) {
        selectedAnts.value.splice(index, 1)
      } else {
        selectedAnts.value.push(antId)
      }
    } else {
      selectedAnts.value = [antId]
    }
  }

  function clearSelection() {
    selectedAnts.value = []
    moveTarget.value = null
  }

  function setMoveTarget(target: HexCoord) {
    moveTarget.value = target
  }

  function disconnect() {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
    }
    isConnected.value = false
    gameState.value = null
    gameId.value = ''
    playerId.value = ''
    selectedAnts.value = []
  }

  return {
    socket,
    gameId,
    playerId,
    gameState,
    isConnected,
    selectedAnts,
    moveTarget,
    isHost,
    currentPlayer,
    otherPlayers,
    isMyTurn,
    timeRemaining,
    sortedEventLog,
    connect,
    createRoom,
    joinRoom,
    startGame,
    submitCommand,
    moveAnts,
    produceAnts,
    upgradeFacility,
    chooseMutation,
    selectAnt,
    clearSelection,
    setMoveTarget,
    disconnect
  }
})
