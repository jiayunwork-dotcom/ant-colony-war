<template>
  <div class="game-history">
    <div v-if="!selectedReplay" class="history-list">
      <div class="history-header">
        <button class="btn btn-back" @click="$emit('back')">← 返回大厅</button>
        <h2 class="history-title">📜 对局历史</h2>
      </div>

      <div v-if="loading" class="history-empty">加载中...</div>
      <div v-else-if="replays.length === 0" class="history-empty">暂无对局记录</div>
      <div v-else class="replay-list">
        <div
          v-for="replay in replays"
          :key="replay.gameId"
          class="replay-card"
          @click="selectReplay(replay.gameId)"
        >
          <div class="replay-time">{{ formatTime(replay.startTime) }}</div>
          <div class="replay-players">
            <span
              v-for="(name, idx) in replay.playerNames"
              :key="idx"
              class="player-tag"
              :style="{ borderColor: replay.playerColors[idx] }"
            >{{ name }}</span>
          </div>
          <div class="replay-meta">
            <span class="replay-winner">🏆 {{ replay.winnerName }}</span>
            <span class="replay-turns">{{ replay.totalTurns }} 回合</span>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="history-detail">
      <div class="detail-header">
        <button class="btn btn-back" @click="selectedReplay = null; replayData = null">← 返回列表</button>
        <h2 class="detail-title">📊 对局回放</h2>
      </div>

      <div v-if="detailLoading" class="history-empty">加载中...</div>
      <template v-else-if="replayData">
        <div class="score-table">
          <div class="score-row score-header-row">
            <span class="score-name">玩家</span>
            <span class="score-val">领地</span>
            <span class="score-val">食物</span>
            <span class="score-val">击杀</span>
            <span class="score-val">存活</span>
            <span class="score-val total">总分</span>
          </div>
          <div
            v-for="sd in replayData.scoreDetails"
            :key="sd.playerId"
            class="score-row"
            :class="{ winner: sd.playerId === replayData.winnerId }"
          >
            <span class="score-name">
              <span class="color-dot" :style="{ background: getPlayerColor(sd.playerId) }"></span>
              {{ sd.playerName }}
            </span>
            <span class="score-val">{{ sd.territory }}</span>
            <span class="score-val">{{ sd.food }}</span>
            <span class="score-val">{{ sd.kills }}</span>
            <span class="score-val">{{ sd.survivors }}</span>
            <span class="score-val total">{{ sd.total }}</span>
          </div>
        </div>

        <div class="chart-section">
          <div class="chart-tabs">
            <button
              v-for="tab in chartTabs"
              :key="tab.key"
              class="chart-tab"
              :class="{ active: activeChart === tab.key }"
              @click="activeChart = tab.key"
            >{{ tab.label }}</button>
          </div>
          <div class="chart-wrapper">
            <canvas ref="chartCanvas" width="800" height="360"></canvas>
          </div>
        </div>

        <div class="timeline-section">
          <h3 class="timeline-title">⚔️ 战斗事件时间线</h3>
          <div v-if="allBattles.length === 0" class="timeline-empty">本局未发生战斗</div>
          <div v-else class="timeline">
            <div
              v-for="(battle, idx) in allBattles"
              :key="idx"
              class="battle-item"
            >
              <div class="battle-turn">回合 {{ battle.turn }}</div>
              <div class="battle-detail">
                <span class="battle-attacker" :style="{ color: getPlayerColor(battle.attackerId) }">
                  {{ getPlayerName(battle.attackerId) }}
                </span>
                <span class="battle-vs">vs</span>
                <span class="battle-defender" :style="{ color: getPlayerColor(battle.defenderId) }">
                  {{ getPlayerName(battle.defenderId) }}
                </span>
              </div>
              <div class="battle-stats">
                <span>兵力 {{ battle.attackerAntCount }}:{{ battle.defenderAntCount }}</span>
                <span>伤亡 {{ battle.attackerKills }}:{{ battle.defenderKills }}</span>
              </div>
              <div class="battle-pos">坐标 ({{ battle.position.q }}, {{ battle.position.r }})</div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import type { GameReplaySummary, GameReplay, BattleEventRecord } from '@shared/types'

const emit = defineEmits<{
  (e: 'back'): void
}>()

const replays = ref<GameReplaySummary[]>([])
const loading = ref(true)
const selectedReplay = ref<string | null>(null)
const replayData = ref<GameReplay | null>(null)
const detailLoading = ref(false)
const activeChart = ref<'food' | 'territory' | 'ants'>('food')
const chartCanvas = ref<HTMLCanvasElement | null>(null)

const chartTabs = [
  { key: 'food' as const, label: '食物数量' },
  { key: 'territory' as const, label: '领地面积' },
  { key: 'ants' as const, label: '蚂蚁总数' }
]

const allBattles = ref<(BattleEventRecord & { turn: number })[]>([])

onMounted(async () => {
  await fetchReplays()
})

async function fetchReplays() {
  loading.value = true
  try {
    const res = await fetch('/api/replays')
    const data = await res.json()
    if (data.success) {
      replays.value = data.replays
    }
  } catch (e) {
    console.error('Failed to fetch replays:', e)
  } finally {
    loading.value = false
  }
}

async function selectReplay(gameId: string) {
  selectedReplay.value = gameId
  detailLoading.value = true
  replayData.value = null
  try {
    const res = await fetch(`/api/replays/${gameId}`)
    const data = await res.json()
    if (data.success) {
      replayData.value = data.replay
      extractBattles()
      await nextTick()
      drawChart()
    }
  } catch (e) {
    console.error('Failed to fetch replay:', e)
  } finally {
    detailLoading.value = false
  }
}

function extractBattles() {
  if (!replayData.value) return
  const battles: (BattleEventRecord & { turn: number })[] = []
  for (const turn of replayData.value.turns) {
    for (const battle of turn.battleEvents) {
      battles.push({ ...battle, turn: turn.turn })
    }
  }
  allBattles.value = battles
}

function getPlayerColor(playerId: string): string {
  if (!replayData.value) return '#888'
  const idx = replayData.value.playerIds.indexOf(playerId)
  return idx >= 0 ? replayData.value.playerColors[idx] : '#888'
}

function getPlayerName(playerId: string): string {
  if (!replayData.value) return '未知'
  const idx = replayData.value.playerIds.indexOf(playerId)
  return idx >= 0 ? replayData.value.playerNames[idx] : '未知'
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function drawChart() {
  const canvas = chartCanvas.value
  if (!canvas || !replayData.value) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)
  canvas.style.width = rect.width + 'px'
  canvas.style.height = rect.height + 'px'

  const W = rect.width
  const H = rect.height
  const padding = { top: 30, right: 30, bottom: 50, left: 60 }
  const chartW = W - padding.left - padding.right
  const chartH = H - padding.top - padding.bottom

  ctx.clearRect(0, 0, W, H)

  const turns = replayData.value.turns
  if (turns.length === 0) return

  const playerIds = replayData.value.playerIds
  const playerColors = replayData.value.playerColors
  const playerNames = replayData.value.playerNames

  const dataMap: Record<string, number[]> = {}
  for (const pid of playerIds) {
    dataMap[pid] = []
  }

  for (const turn of turns) {
    for (const snap of turn.playerSnapshots) {
      if (activeChart.value === 'food') {
        dataMap[snap.playerId]?.push(snap.food)
      } else if (activeChart.value === 'territory') {
        dataMap[snap.playerId]?.push(snap.territoryCount)
      } else {
        dataMap[snap.playerId]?.push(snap.workerCount + snap.soldierCount + snap.scoutCount)
      }
    }
  }

  let maxVal = 0
  for (const pid of playerIds) {
    for (const v of dataMap[pid]) {
      if (v > maxVal) maxVal = v
    }
  }
  if (maxVal === 0) maxVal = 1

  const yTicks = calculateTicks(0, maxVal, 5)
  const yMax = yTicks[yTicks.length - 1]

  ctx.strokeStyle = '#333'
  ctx.lineWidth = 1
  ctx.fillStyle = '#888'
  ctx.font = '12px sans-serif'

  for (const tick of yTicks) {
    const y = padding.top + chartH - (tick / yMax) * chartH
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(padding.left + chartW, y)
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.stroke()
    ctx.textAlign = 'right'
    ctx.fillText(String(tick), padding.left - 8, y + 4)
  }

  const xStep = turns.length > 1 ? chartW / (turns.length - 1) : chartW
  ctx.textAlign = 'center'
  const xTickInterval = Math.max(1, Math.floor(turns.length / 10))
  for (let i = 0; i < turns.length; i++) {
    if (i % xTickInterval === 0 || i === turns.length - 1) {
      const x = padding.left + i * xStep
      ctx.fillText(String(turns[i].turn), x, H - padding.bottom + 20)
    }
  }

  ctx.fillStyle = '#aaa'
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('回合', padding.left + chartW / 2, H - 5)

  ctx.save()
  ctx.translate(14, padding.top + chartH / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.textAlign = 'center'
  const yLabel = activeChart.value === 'food' ? '食物' : activeChart.value === 'territory' ? '领地' : '蚂蚁数'
  ctx.fillText(yLabel, 0, 0)
  ctx.restore()

  for (let pi = 0; pi < playerIds.length; pi++) {
    const pid = playerIds[pi]
    const data = dataMap[pid]
    if (!data || data.length === 0) continue

    ctx.strokeStyle = playerColors[pi]
    ctx.lineWidth = 2
    ctx.beginPath()

    for (let i = 0; i < data.length; i++) {
      const x = padding.left + i * xStep
      const y = padding.top + chartH - (data[i] / yMax) * chartH
      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()

    const lastX = padding.left + (data.length - 1) * xStep
    const lastY = padding.top + chartH - (data[data.length - 1] / yMax) * chartH
    ctx.fillStyle = playerColors[pi]
    ctx.beginPath()
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2)
    ctx.fill()
  }

  const legendY = padding.top - 10
  let legendX = padding.left
  ctx.font = '12px sans-serif'
  for (let pi = 0; pi < playerIds.length; pi++) {
    ctx.fillStyle = playerColors[pi]
    ctx.fillRect(legendX, legendY - 8, 12, 12)
    ctx.fillStyle = '#ccc'
    ctx.textAlign = 'left'
    ctx.fillText(playerNames[pi], legendX + 16, legendY + 2)
    legendX += ctx.measureText(playerNames[pi]).width + 36
  }
}

function calculateTicks(min: number, max: number, targetCount: number): number[] {
  const range = max - min
  if (range === 0) return [0]
  const roughStep = range / targetCount
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)))
  const residual = roughStep / magnitude
  let niceStep: number
  if (residual <= 1.5) niceStep = magnitude
  else if (residual <= 3) niceStep = 2 * magnitude
  else if (residual <= 7) niceStep = 5 * magnitude
  else niceStep = 10 * magnitude

  const ticks: number[] = []
  let tick = Math.ceil(min / niceStep) * niceStep
  while (tick <= max) {
    ticks.push(Math.round(tick * 1000) / 1000)
    tick += niceStep
  }
  if (ticks.length < 2) {
    ticks.push(max)
  }
  return ticks
}

watch(activeChart, () => {
  if (replayData.value) {
    nextTick(() => drawChart())
  }
})
</script>

<style scoped>
.game-history {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  overflow-y: auto;
  padding: 20px;
}

.history-header,
.detail-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  flex-shrink: 0;
}

.btn-back {
  background: rgba(255,255,255,0.1);
  color: #4ecdc4;
  border: 1px solid rgba(78, 205, 196, 0.3);
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn-back:hover {
  background: rgba(78, 205, 196, 0.15);
}

.history-title,
.detail-title {
  font-size: 24px;
  font-weight: 700;
  color: #e94560;
  margin: 0;
}

.history-empty {
  text-align: center;
  color: #666;
  padding: 40px 0;
  font-size: 14px;
}

.replay-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
}

.replay-card {
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.replay-card:hover {
  background: rgba(78, 205, 196, 0.08);
  border-color: rgba(78, 205, 196, 0.3);
}

.replay-time {
  font-size: 13px;
  color: #888;
  margin-bottom: 8px;
}

.replay-players {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.player-tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid;
  color: #ddd;
  background: rgba(255,255,255,0.05);
}

.replay-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.replay-winner {
  font-size: 14px;
  font-weight: 600;
  color: #ffeaa7;
}

.replay-turns {
  font-size: 13px;
  color: #888;
}

.score-table {
  background: rgba(0,0,0,0.4);
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 20px;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

.score-row {
  display: flex;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}

.score-row:last-child {
  border-bottom: none;
}

.score-header-row {
  color: #888;
  font-size: 12px;
  font-weight: 600;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.score-name {
  flex: 2;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.score-val {
  flex: 1;
  text-align: center;
  font-size: 13px;
  color: #aaa;
}

.score-val.total {
  color: #e94560;
  font-weight: 700;
}

.score-row.winner .score-name {
  color: #ffeaa7;
}

.score-row.winner .score-val.total {
  color: #ffeaa7;
}

.chart-section {
  max-width: 800px;
  margin: 0 auto 20px;
  width: 100%;
}

.chart-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.chart-tab {
  padding: 8px 20px;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  background: rgba(0,0,0,0.3);
  color: #888;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.chart-tab.active {
  background: #e94560;
  color: #fff;
  border-color: #e94560;
}

.chart-tab:hover:not(.active) {
  background: rgba(255,255,255,0.08);
  color: #ccc;
}

.chart-wrapper {
  background: rgba(0,0,0,0.5);
  border-radius: 10px;
  padding: 16px;
  border: 1px solid rgba(255,255,255,0.06);
}

.chart-wrapper canvas {
  width: 100%;
  height: 360px;
  display: block;
}

.timeline-section {
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.timeline-title {
  font-size: 18px;
  color: #e94560;
  margin-bottom: 16px;
}

.timeline-empty {
  text-align: center;
  color: #666;
  padding: 20px 0;
}

.timeline {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.battle-item {
  background: rgba(0,0,0,0.35);
  border-radius: 8px;
  padding: 12px 16px;
  border-left: 3px solid #e94560;
}

.battle-turn {
  font-size: 12px;
  color: #888;
  margin-bottom: 4px;
}

.battle-detail {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}

.battle-vs {
  color: #666;
  margin: 0 8px;
}

.battle-stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #aaa;
  margin-bottom: 2px;
}

.battle-pos {
  font-size: 11px;
  color: #666;
}
</style>
