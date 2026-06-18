<template>
  <div class="app">
    <GameLobby
      v-if="!gameState"
      :on-create-room="handleCreateRoom"
      :on-join-room="handleJoinRoom"
      @room-created="onRoomCreated"
      @room-joined="onRoomJoined"
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
        :players="gameState.players"
        :winner-id="gameState.winner"
        :current-player-id="playerId"
        @restart="handleRestart"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch } from 'vue'
import { useGameStore } from './stores/game'
import { storeToRefs } from 'pinia'
import GameLobby from './components/GameLobby.vue'
import TopBar from './components/TopBar.vue'
import HexMap from './components/HexMap.vue'
import ControlPanel from './components/ControlPanel.vue'
import EventLog from './components/EventLog.vue'
import GameOverModal from './components/GameOverModal.vue'
import type { HexCoord, HexCell, AntType, FacilityType, MutationType } from '@shared/types'

const gameStore = useGameStore()
const {
  gameState,
  playerId,
  currentPlayer,
  isHost,
  isMyTurn,
  timeRemaining,
  sortedEventLog,
  selectedAnts
} = storeToRefs(gameStore)

let timerInterval: number | null = null

onMounted(() => {
  gameStore.connect()
  startTimer()
})

onUnmounted(() => {
  if (timerInterval) {
    clearInterval(timerInterval)
  }
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

function onRoomCreated(_gameId: string, _playerId: string) {
}

function onRoomJoined(_gameId: string, _playerId: string) {
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

function handleRestart() {
  gameStore.disconnect()
  gameStore.connect()
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
