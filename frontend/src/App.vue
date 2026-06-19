<template>
  <div class="app">
    <AIReplayAnalysis
      v-if="showAIReplay && aiReplayData"
      :replay-data="aiReplayData"
      @back="handleCloseAIReplay"
    />

    <GameHistory
      v-else-if="showHistory"
      @back="showHistory = false"
    />

    <GameLobby
      v-else-if="!gameState"
      :on-create-room="handleCreateRoom"
      :on-join-room="handleJoinRoom"
      :rooms="roomList"
      :on-quick-join="handleQuickJoin"
      @room-created="onRoomCreated"
      @room-joined="onRoomJoined"
      @show-history="showHistory = true"
    />

    <WaitingLobby
      v-else-if="gameState.phase === 'waiting'"
      :game-id="gameState.id"
      :player-id="playerId"
      :host-id="gameState.hostId"
      :players="gameState.players"
      :is-host="isHost"
      :ai-player-ids="aiPlayerIds"
      @toggle-ready="handleToggleReady"
      @start-game="handleStartGame"
      @leave-room="handleLeaveRoom"
      @add-ai="handleAddAI"
      @remove-ai="handleRemoveAI"
    />

    <template v-else>
      <div class="game-layout">
        <TopBar
          :turn="gameState.turn"
          :max-turns="gameState.maxTurns"
          :phase="gameState.phase"
          :time-remaining="timeRemaining"
          :players="gameState.players"
          :current-player-id="playerId"
          :is-host="isHost"
          :is-my-turn="isMyTurn"
          @start-game="handleStartGame"
          @ready="handleReady"
        />

        <div class="game-body">
          <div class="map-area">
            <HexMap
              @cell-click="handleCellClick"
              @ant-click="handleAntClick"
              @right-click="handleRightClick"
            />
          </div>

          <ControlPanel
            :player="currentPlayer"
            :selected-ants="selectedAnts"
            :is-my-turn="isMyTurn"
            @produce="handleProduce"
            @upgrade="handleUpgrade"
            @choose-mutation="handleChooseMutation"
            @clear-selection="clearSelection"
          />
        </div>

        <div class="log-area">
          <EventLog :events="sortedEventLog" />
        </div>
      </div>

      <GameOverModal
        :show="gameState.phase === 'ended'"
        :game-id="gameState.id"
        :players="gameState.players"
        :winner-id="gameState.winner"
        :current-player-id="playerId"
        @restart="handleRestart"
        @show-ai-replay="handleShowAIReplay"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch } from 'vue'
import { useGameStore } from './stores/game'
import { storeToRefs } from 'pinia'
import GameLobby from './components/GameLobby.vue'
import WaitingLobby from './components/WaitingLobby.vue'
import TopBar from './components/TopBar.vue'
import HexMap from './components/HexMap.vue'
import ControlPanel from './components/ControlPanel.vue'
import EventLog from './components/EventLog.vue'
import GameOverModal from './components/GameOverModal.vue'
import GameHistory from './components/GameHistory.vue'
import AIReplayAnalysis from './components/AIReplayAnalysis.vue'
import type { HexCoord, HexCell, AntType, FacilityType, MutationType, AIDifficulty } from '@shared/types'

const gameStore = useGameStore()
const {
  gameState,
  playerId,
  currentPlayer,
  isHost,
  isMyTurn,
  timeRemaining,
  sortedEventLog,
  selectedAnts,
  roomList,
  aiPlayerIds,
  showAIReplay,
  aiReplayData
} = storeToRefs(gameStore)

const showHistory = ref(false)

let timerInterval: number | null = null

onMounted(() => {
  gameStore.connect()
  gameStore.startRoomListPolling()
  startTimer()
})

onUnmounted(() => {
  if (timerInterval) {
    clearInterval(timerInterval)
  }
  gameStore.stopRoomListPolling()
  gameStore.disconnect()
})

function startTimer() {
  timerInterval = window.setInterval(() => {
  }, 1000)
}

async function handleCreateRoom(playerName: string) {
  return await gameStore.createRoom(playerName)
}

async function handleJoinRoom(roomId: string, playerName: string) {
  return await gameStore.joinRoom(roomId, playerName)
}

async function handleQuickJoin(roomId: string, playerName: string) {
  return await gameStore.joinRoom(roomId, playerName)
}

function onRoomCreated(_gameId: string, _playerId: string) {
  gameStore.stopRoomListPolling()
}

function onRoomJoined(_gameId: string, _playerId: string) {
  gameStore.stopRoomListPolling()
}

async function handleToggleReady() {
  await gameStore.toggleReady()
}

async function handleStartGame() {
  await gameStore.startGame()
}

async function handleReady() {
  await gameStore.submitCommand({})
}

function handleCellClick(_coord: HexCoord, _cell: HexCell) {
}

function handleAntClick(antId: string) {
  gameStore.selectAnt(antId, false)
}

function handleRightClick(coord: HexCoord) {
  if (selectedAnts.value.length > 0 && isMyTurn.value) {
    gameStore.moveAnts(coord)
  }
}

async function handleProduce(type: AntType) {
  await gameStore.produceAnts(type, 1)
}

async function handleUpgrade(facilityType: FacilityType) {
  await gameStore.upgradeFacility(facilityType)
}

async function handleChooseMutation(mutation: MutationType) {
  await gameStore.chooseMutation(mutation)
}

function clearSelection() {
  gameStore.clearSelection()
}

async function handleLeaveRoom() {
  await gameStore.leaveRoom()
  gameStore.startRoomListPolling()
}

async function handleAddAI(difficulty: AIDifficulty) {
  console.log('[App] handleAddAI called with difficulty:', difficulty)
  const result = await gameStore.addAIPlayer(difficulty)
  console.log('[App] handleAddAI result:', result)
}

async function handleRemoveAI(playerId: string) {
  console.log('[App] handleRemoveAI called with playerId:', playerId)
  const result = await gameStore.removeAIPlayer(playerId)
  console.log('[App] handleRemoveAI result:', result)
}

function handleRestart() {
  gameStore.disconnect()
  gameStore.connect()
  gameStore.startRoomListPolling()
}

async function handleShowAIReplay(gameId: string) {
  console.log('[App] handleShowAIReplay called with gameId:', gameId)
  try {
    const result = await gameStore.fetchAIReplayData(gameId)
    console.log('[App] fetchAIReplayData result:', result)
    if (result.success && result.data) {
      console.log('[App] Opening AI replay page')
      gameStore.openAIReplay()
    } else {
      alert(`复盘数据加载失败：${result.error || '未知错误'}`)
    }
  } catch (e) {
    console.error('[App] handleShowAIReplay error:', e)
    alert(`复盘数据加载异常：${e instanceof Error ? e.message : String(e)}`)
  }
}

function handleCloseAIReplay() {
  gameStore.closeAIReplay()
}

watch(gameState, (newState) => {
  if (newState && newState.phase === 'ended') {
  }
}, { deep: true })
</script>

<style scoped>
.app {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.game-layout {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.game-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.map-area {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.log-area {
  height: 180px;
  flex-shrink: 0;
}
</style>
