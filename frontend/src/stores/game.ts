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
  MutationType,
  RoomInfo,
  AIDifficulty,
  GameReplayWithAI
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
  const roomList = ref<RoomInfo[]>([])
  const aiPlayerIds = ref<string[]>([])
  const showAIReplay = ref(false)
  const aiReplayData = ref<GameReplayWithAI | null>(null)
  const isLoadingAIReplay = ref(false)
  let roomListTimer: number | null = null

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

  function updateAIPlayerIds() {
    if (!gameState.value) {
      aiPlayerIds.value = []
      return
    }
    aiPlayerIds.value = gameState.value.players
      .filter(p => p.name.startsWith('AI-'))
      .map(p => p.id)
  }

  function connect() {
    if (socket.value && isConnected.value) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    const port = window.location.port || (window.location.protocol === 'https:' ? '443' : '80')

    const socketUrl = `${protocol}//${host}:${port}`
    console.log('[GameStore] Connecting to socket at:', socketUrl)
    socket.value = io(socketUrl, {
      transports: ['websocket', 'polling']
    })

    socket.value.on('connect', () => {
      isConnected.value = true
      console.log('[GameStore] Connected to server, socket.id:', socket.value?.id)
    })

    socket.value.on('connect_error', (error) => {
      isConnected.value = false
      console.error('[GameStore] Connection error:', error.message)
    })

    socket.value.on('disconnect', () => {
      isConnected.value = false
      console.log('[GameStore] Disconnected from server')
    })

    socket.value.on('player_joined', (data: { players: Player[] }) => {
      console.log('[GameStore] player_joined event, players:', data.players.length)
      if (gameState.value) {
        gameState.value.players = data.players
        updateAIPlayerIds()
      }
    })

    socket.value.on('player_left', (data: { playerId: string; players: Player[]; newHostId?: string }) => {
      console.log('[GameStore] player_left event, playerId:', data.playerId)
      if (gameState.value) {
        gameState.value.players = data.players
        if (data.newHostId) {
          gameState.value.hostId = data.newHostId
          if (data.newHostId === playerId.value) {
            isHost.value = true
          }
        }
        updateAIPlayerIds()
      }
    })

    socket.value.on('lobby_ready_update', (data: { players: Player[] }) => {
      console.log('[GameStore] lobby_ready_update event')
      if (gameState.value) {
        gameState.value.players = data.players
      }
    })

    socket.value.on('game_started', (data: { state: GameState }) => {
      console.log('[GameStore] game_started event, turn:', data.state.turn)
      gameState.value = data.state
    })

    socket.value.on('turn_processed', (data: { state: GameState }) => {
      console.log('[GameStore] turn_processed event, turn:', data.state.turn)
      gameState.value = data.state
      selectedAnts.value = []
      moveTarget.value = null
    })

    socket.value.on('player_ready', (data: { playerId: string; players: Player[] }) => {
      console.log('[GameStore] player_ready event, playerId:', data.playerId)
      if (gameState.value) {
        gameState.value.players = data.players
      }
    })

    socket.value.on('time_warning', (data: { remaining: number }) => {
      console.log('[GameStore] Time warning:', data.remaining, 'seconds')
    })
  }

  function emitWithTimeout<T = any>(event: string, data: any, timeoutMs: number = 10000): Promise<T> {
    return new Promise((resolve) => {
      if (!socket.value) {
        resolve({ success: false, error: 'Not connected' } as T)
        return
      }

      const timeoutId = setTimeout(() => {
        console.error(`[GameStore] Timeout waiting for response to event: ${event}`)
        resolve({ success: false, error: `请求超时：${event}，请检查网络连接或重试` } as T)
      }, timeoutMs)

      console.log(`[GameStore] Emitting event: ${event}, data:`, data)
      socket.value.emit(event, data, (response: any) => {
        clearTimeout(timeoutId)
        console.log(`[GameStore] Got response for event: ${event}, response:`, response)
        resolve(response)
      })
    })
  }

  function createRoom(playerName: string): Promise<{ success: boolean; error?: string }> {
    return emitWithTimeout('create_room', { playerName }, 15000).then((response: any) => {
      if (response?.success) {
        gameId.value = response.gameId
        playerId.value = response.playerId
        gameState.value = response.state
        isHost.value = true
        updateAIPlayerIds()
        console.log('[GameStore] createRoom success, gameId:', response.gameId)
      } else {
        console.error('[GameStore] createRoom failed:', response?.error)
      }
      return response
    })
  }

  function joinRoom(roomId: string, playerName: string): Promise<{ success: boolean; error?: string }> {
    return emitWithTimeout('join_room', { gameId: roomId, playerName }, 15000).then((response: any) => {
      if (response?.success) {
        gameId.value = response.gameId
        playerId.value = response.playerId
        gameState.value = response.state
        isHost.value = gameState.value.hostId === response.playerId
        updateAIPlayerIds()
        console.log('[GameStore] joinRoom success, gameId:', response.gameId)
      } else {
        console.error('[GameStore] joinRoom failed:', response?.error)
      }
      return response
    })
  }

  function addAIPlayer(difficulty: AIDifficulty): Promise<{ success: boolean; error?: string }> {
    console.log('[GameStore] addAIPlayer called. difficulty:', difficulty, 'gameId:', gameId.value, 'socket connected:', !!socket.value)
    return emitWithTimeout('add_ai_player', { gameId: gameId.value, difficulty }, 10000).then((response: any) => {
      console.log('[GameStore] addAIPlayer response:', response)
      if (response?.success && response.state) {
        gameState.value = response.state
        updateAIPlayerIds()
        console.log('[GameStore] addAIPlayer success')
      } else if (response?.error) {
        console.error('[GameStore] addAIPlayer failed with error:', response.error)
      }
      return response
    })
  }

  function removeAIPlayer(playerId: string): Promise<{ success: boolean; error?: string }> {
    console.log('[GameStore] removeAIPlayer called. playerId:', playerId, 'gameId:', gameId.value, 'socket connected:', !!socket.value)
    return emitWithTimeout('remove_ai_player', { gameId: gameId.value, playerId }, 10000).then((response: any) => {
      console.log('[GameStore] removeAIPlayer response:', response)
      if (response?.success && response.state) {
        gameState.value = response.state
        updateAIPlayerIds()
        console.log('[GameStore] removeAIPlayer success')
      } else if (response?.error) {
        console.error('[GameStore] removeAIPlayer failed with error:', response.error)
      }
      return response
    })
  }

  function toggleReady(): Promise<{ success: boolean; error?: string }> {
    return emitWithTimeout('toggle_ready', { gameId: gameId.value }, 10000)
  }

  function startGame(): Promise<{ success: boolean; error?: string }> {
    return emitWithTimeout('start_game', { gameId: gameId.value }, 15000).then((response: any) => {
      if (response?.success && response.state) {
        gameState.value = response.state
        console.log('[GameStore] startGame success')
      }
      return response
    })
  }

  function submitCommand(command: Partial<PlayerCommand>): Promise<{ success: boolean; error?: string }> {
    if (!socket.value || !gameId.value || !playerId.value) {
      return Promise.resolve({ success: false, error: 'Not connected or no game' })
    }

    const fullCommand: PlayerCommand = {
      playerId: playerId.value,
      moveCommands: command.moveCommands || [],
      buildCommands: command.buildCommands || [],
      produceCommands: command.produceCommands || [],
      upgradeCommands: command.upgradeCommands || [],
      chooseMutation: command.chooseMutation
    }

    return emitWithTimeout('submit_command', {
      gameId: gameId.value,
      command: fullCommand
    }, 15000)
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

  async function fetchRoomList() {
    try {
      const response = await fetch('/api/rooms')
      const data = await response.json()
      if (data.success) {
        roomList.value = data.rooms
      }
    } catch (e) {
      console.error('[GameStore] Failed to fetch room list:', e)
    }
  }

  function startRoomListPolling() {
    stopRoomListPolling()
    fetchRoomList()
    roomListTimer = window.setInterval(() => {
      fetchRoomList()
    }, 5000)
  }

  function stopRoomListPolling() {
    if (roomListTimer) {
      clearInterval(roomListTimer)
      roomListTimer = null
    }
  }

  function leaveRoom(): Promise<{ success: boolean; error?: string }> {
    const result = emitWithTimeout('leave_room', { gameId: gameId.value }, 10000)
    gameState.value = null
    gameId.value = ''
    playerId.value = ''
    isHost.value = false
    return result
  }

  function disconnect() {
    stopRoomListPolling()
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
    }
    isConnected.value = false
    gameState.value = null
    gameId.value = ''
    playerId.value = ''
    selectedAnts.value = []
    isHost.value = false
  }

  async function checkAIReplayValid(gameId: string): Promise<{ valid: boolean; message?: string }> {
    try {
      const response = await fetch(`/api/replays/${gameId}/ai/valid`)
      const data = await response.json()
      return { valid: data.valid, message: data.message }
    } catch (e) {
      console.error('[GameStore] Failed to check AI replay validity:', e)
      return { valid: false, message: '网络错误' }
    }
  }

  async function fetchAIReplayData(gameId: string): Promise<{ success: boolean; data?: GameReplayWithAI; error?: string }> {
    isLoadingAIReplay.value = true
    console.log('[GameStore] Fetching AI replay data for game:', gameId)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)
      
      const response = await fetch(`/api/replays/${gameId}/ai`, {
        signal: controller.signal
      })
      clearTimeout(timeoutId)
      
      const data = await response.json()
      console.log('[GameStore] AI replay response received, success:', data.success, 'has replay:', !!data.replay, 'replay size:', JSON.stringify(data.replay || '').length, 'bytes')
      
      if (data.success && data.replay) {
        aiReplayData.value = data.replay
        isLoadingAIReplay.value = false
        console.log('[GameStore] AI replay data loaded successfully, AI players:', data.replay.aiReplayData?.length || 0)
        return { success: true, data: data.replay }
      }
      isLoadingAIReplay.value = false
      return { success: false, error: data.error || '获取复盘数据失败' }
    } catch (e) {
      console.error('[GameStore] Failed to fetch AI replay data:', e)
      isLoadingAIReplay.value = false
      if (e instanceof Error && e.name === 'AbortError') {
        return { success: false, error: '请求超时，请重试' }
      }
      return { success: false, error: e instanceof Error ? e.message : '网络错误' }
    }
  }

  function openAIReplay() {
    showAIReplay.value = true
  }

  function closeAIReplay() {
    showAIReplay.value = false
    aiReplayData.value = null
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
    roomList,
    aiPlayerIds,
    showAIReplay,
    aiReplayData,
    isLoadingAIReplay,
    currentPlayer,
    otherPlayers,
    isMyTurn,
    timeRemaining,
    sortedEventLog,
    connect,
    createRoom,
    joinRoom,
    toggleReady,
    startGame,
    submitCommand,
    moveAnts,
    produceAnts,
    upgradeFacility,
    chooseMutation,
    selectAnt,
    clearSelection,
    setMoveTarget,
    fetchRoomList,
    startRoomListPolling,
    stopRoomListPolling,
    leaveRoom,
    disconnect,
    addAIPlayer,
    removeAIPlayer,
    checkAIReplayValid,
    fetchAIReplayData,
    openAIReplay,
    closeAIReplay
  }
})
