<template>
  <div class="game-history">
    <div v-if="!selectedReplay" class="history-list">
      <div class="history-header">
        <button class="btn btn-back" @click="$emit('back')">← 返回大厅</button>
        <h2 class="history-title">📜 对局历史</h2>
      </div>

      <div class="search-bar">
        <input
          v-model="searchKeyword"
          type="text"
          class="search-input"
          placeholder="🔍 搜索玩家名..."
        />
      </div>

      <div v-if="loading" class="history-empty">加载中...</div>
      <div v-else-if="filteredReplays.length === 0" class="history-empty">暂无对局记录</div>
      <div v-else class="replay-list">
        <div
          v-for="replay in filteredReplays"
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
        <button class="btn btn-back" @click="selectedReplay = null; replayData = null; currentTurn = 0; searchKeyword = ''">← 返回列表</button>
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
            <canvas
              ref="chartCanvas"
              width="800"
              height="360"
              @mousemove="handleChartMouseMove"
              @mouseleave="handleChartMouseLeave"
            ></canvas>
            <div
              v-if="showTooltip && tooltipData.length > 0"
              class="chart-tooltip"
              :style="{ left: tooltipX + 'px', top: tooltipY + 'px' }"
            >
              <div class="tooltip-turn">回合 {{ tooltipTurn }}</div>
              <div
                v-for="item in tooltipData"
                :key="item.playerId"
                class="tooltip-item"
              >
                <span class="tooltip-dot" :style="{ background: item.color }"></span>
                <span class="tooltip-name">{{ item.name }}</span>
                <span class="tooltip-value">{{ item.value }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="turn-progress-section">
          <div class="turn-progress-label">
            <span>回合进度</span>
            <span class="turn-current">当前: 第 {{ currentTurnDisplay }} 回合</span>
          </div>
          <div class="turn-progress-bar">
            <input
              type="range"
              :min="1"
              :max="maxTurn"
              :value="currentTurn"
              @input="handleTurnSliderInput"
              class="turn-slider"
            />
          </div>
        </div>

        <div class="timeline-section">
          <h3 class="timeline-title">⚔️ 战斗事件时间线</h3>
          <div v-if="filteredBattles.length === 0" class="timeline-empty">
            {{ currentTurn < maxTurn ? '当前回合之前未发生战斗' : '本局未发生战斗' }}
          </div>
          <div v-else class="timeline">
            <div
              v-for="(battle, idx) in filteredBattles"
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
              <div class="casualty-bar-wrapper">
                <div class="casualty-bar">
                  <div
                    class="casualty-attacker"
                    :style="{
                      width: getAttackerCasualtyWidth(battle) + 'px',
                      background: getPlayerColor(battle.attackerId)
                    }"
                  ></div>
                  <div
                    class="casualty-defender"
                    :style="{
                      width: getDefenderCasualtyWidth(battle) + 'px',
                      background: getPlayerColor(battle.defenderId)
                    }"
                  ></div>
                </div>
                <span class="casualty-label">伤亡占比</span>
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
import { ref, onMounted, watch, nextTick, computed } from 'vue'
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

const searchKeyword = ref('')

const currentTurn = ref(0)

const showTooltip = ref(false)
const tooltipX = ref(0)
const tooltipY = ref(0)
const tooltipTurn = ref(0)
const tooltipData = ref<{ playerId: string; name: string; value: number; color: string }[]>([])

let chartLayout = {
  padding: { top: 30, right: 30, bottom: 50, left: 60 },
  chartW: 0,
  chartH: 0,
  xStep: 0,
  turnCount: 0,
  yMax: 0
}

interface ChartCache {
  dataMap: Record<string, number[]>
  eliminatedAt: Record<string, number>
  playerIds: string[]
  playerColors: string[]
  playerNames: string[]
}
let chartCache: ChartCache | null = null

const chartTabs = [
  { key: 'food' as const, label: '食物数量' },
  { key: 'territory' as const, label: '领地面积' },
  { key: 'ants' as const, label: '蚂蚁总数' }
]

const allBattles = ref<(BattleEventRecord & { turn: number })[]>([])

const filteredReplays = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return replays.value
  return replays.value.filter(r =>
    r.playerNames.some(name => name.toLowerCase().includes(kw))
  )
})

const maxTurn = computed(() => {
  if (!replayData.value) return 0
  return replayData.value.turns.length
})

const currentTurnDisplay = computed(() => {
  if (currentTurn.value === 0 && maxTurn.value > 0) return maxTurn.value
  return currentTurn.value
})

const filteredBattles = computed(() => {
  const limit = currentTurn.value === 0 ? maxTurn.value : currentTurn.value
  return allBattles.value.filter(b => b.turn <= limit)
})

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
  currentTurn.value = 0
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

function getAttackerCasualtyWidth(battle: BattleEventRecord & { turn: number }): number {
  const total = battle.attackerKills + battle.defenderKills
  if (total === 0) return 0
  return Math.round((battle.attackerKills / total) * 120)
}

function getDefenderCasualtyWidth(battle: BattleEventRecord & { turn: number }): number {
  const total = battle.attackerKills + battle.defenderKills
  if (total === 0) return 0
  return Math.round((battle.defenderKills / total) * 120)
}

function handleTurnSliderInput(e: Event) {
  const target = e.target as HTMLInputElement
  currentTurn.value = parseInt(target.value, 10)
  drawChart()
}

function handleChartMouseMove(e: MouseEvent) {
  if (!chartCanvas.value || !replayData.value || !chartCache) return

  const rect = chartCanvas.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  const { padding, xStep, turnCount } = chartLayout
  if (x < padding.left || x > padding.left + chartLayout.chartW ||
      y < padding.top || y > padding.top + chartLayout.chartH) {
    showTooltip.value = false
    drawChart()
    return
  }

  const relativeX = x - padding.left
  let turnIdx = Math.round(relativeX / xStep)
  turnIdx = Math.max(0, Math.min(turnIdx, turnCount - 1))

  const turnData: { playerId: string; name: string; value: number; color: string }[] = []
  for (let pi = 0; pi < chartCache.playerIds.length; pi++) {
    const pid = chartCache.playerIds[pi]
    const dataArr = chartCache.dataMap[pid]
    if (dataArr && turnIdx < dataArr.length) {
      turnData.push({
        playerId: pid,
        name: chartCache.playerNames[pi],
        value: dataArr[turnIdx],
        color: chartCache.playerColors[pi]
      })
    }
  }

  const turnNumber = replayData.value.turns[turnIdx]?.turn ?? turnIdx + 1
  tooltipTurn.value = turnNumber
  tooltipData.value = turnData
  showTooltip.value = true

  const lineX = padding.left + turnIdx * xStep
  tooltipX.value = Math.min(lineX + 15, rect.width - 180)
  tooltipY.value = Math.max(padding.top, y - 60)

  drawChart(turnIdx)
}

function handleChartMouseLeave() {
  showTooltip.value = false
  drawChart()
}

function buildChartCache() {
  if (!replayData.value) return

  const turns = replayData.value.turns
  const playerIds = replayData.value.playerIds
  const playerColors = replayData.value.playerColors
  const playerNames = replayData.value.playerNames

  const dataMap: Record<string, number[]> = {}
  const eliminatedAt: Record<string, number> = {}
  for (const pid of playerIds) {
    dataMap[pid] = []
    eliminatedAt[pid] = -1
  }

  for (let ti = 0; ti < turns.length; ti++) {
    const turn = turns[ti]
    const existingIds = new Set(turn.playerSnapshots.map(s => s.playerId))

    for (const pid of playerIds) {
      if (eliminatedAt[pid] >= 0) continue

      const snap = turn.playerSnapshots.find(s => s.playerId === pid)
      if (snap) {
        let val: number
        if (activeChart.value === 'food') {
          val = snap.food
        } else if (activeChart.value === 'territory') {
          val = snap.territoryCount
        } else {
          val = snap.workerCount + snap.soldierCount + snap.scoutCount
        }
        dataMap[pid].push(val)
      } else {
        eliminatedAt[pid] = ti
      }
    }
  }

  chartCache = { dataMap, eliminatedAt, playerIds, playerColors, playerNames }
}

function drawChart(hoverTurnIdx: number = -1) {
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

  buildChartCache()
  if (!chartCache) return

  const { dataMap, eliminatedAt, playerIds, playerColors, playerNames } = chartCache

  chartLayout = {
    padding,
    chartW,
    chartH,
    xStep: turns.length > 1 ? chartW / (turns.length - 1) : chartW,
    turnCount: turns.length,
    yMax: 0
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
  chartLayout.yMax = yMax

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
    ctx.fillStyle = '#888'
    ctx.fillText(String(tick), padding.left - 8, y + 4)
  }

  const xStep = turns.length > 1 ? chartW / (turns.length - 1) : chartW
  ctx.textAlign = 'center'
  ctx.fillStyle = '#888'
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

  const sliderTurnIdx = currentTurn.value === 0 ? turns.length - 1 : currentTurn.value - 1

  for (let pi = 0; pi < playerIds.length; pi++) {
    const pid = playerIds[pi]
    const data = dataMap[pid]
    if (!data || data.length === 0) continue

    const elimIdx = eliminatedAt[pid]

    function drawSegment(startIdx: number, endIdx: number, alpha: number) {
      if (startIdx >= endIdx) return
      ctx.strokeStyle = playerColors[pi]
      ctx.globalAlpha = alpha
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = startIdx; i <= endIdx; i++) {
        if (i >= data.length) break
        const x = padding.left + i * xStep
        const y = padding.top + chartH - (data[i] / yMax) * chartH
        if (i === startIdx) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    const activeEndIdx = elimIdx >= 0 ? Math.min(elimIdx, sliderTurnIdx) : sliderTurnIdx
    const fullEndIdx = elimIdx >= 0 ? elimIdx : data.length - 1

    drawSegment(0, activeEndIdx, 1)

    if (activeEndIdx < fullEndIdx) {
      drawSegment(activeEndIdx, fullEndIdx, 0.25)
    }

    for (let i = 0; i < data.length; i++) {
      if (elimIdx >= 0 && i > elimIdx) break
      const x = padding.left + i * xStep
      const y = padding.top + chartH - (data[i] / yMax) * chartH
      const alpha = i <= sliderTurnIdx ? 1 : 0.3
      ctx.globalAlpha = alpha
      ctx.fillStyle = playerColors[pi]
      ctx.beginPath()
      ctx.arc(x, y, 3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    if (elimIdx >= 0 && elimIdx < data.length + 1) {
      const crossIdx = elimIdx
      if (crossIdx < data.length) {
        const crossX = padding.left + crossIdx * xStep
        const crossY = padding.top + chartH - (data[crossIdx] / yMax) * chartH
        const size = 6
        ctx.strokeStyle = '#FF3333'
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.moveTo(crossX - size, crossY - size)
        ctx.lineTo(crossX + size, crossY + size)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(crossX + size, crossY - size)
        ctx.lineTo(crossX - size, crossY + size)
        ctx.stroke()
      } else {
        const crossX = padding.left + (data.length - 1) * xStep
        const crossY = padding.top + chartH - (data[data.length - 1] / yMax) * chartH
        const size = 6
        ctx.strokeStyle = '#FF3333'
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.moveTo(crossX - size, crossY - size)
        ctx.lineTo(crossX + size, crossY + size)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(crossX + size, crossY - size)
        ctx.lineTo(crossX - size, crossY + size)
        ctx.stroke()
      }
    }
  }

  if (hoverTurnIdx >= 0) {
    const lineX = padding.left + hoverTurnIdx * xStep
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'
    ctx.lineWidth = 1
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(lineX, padding.top)
    ctx.lineTo(lineX, padding.top + chartH)
    ctx.stroke()
    ctx.setLineDash([])

    for (let pi = 0; pi < playerIds.length; pi++) {
      const pid = playerIds[pi]
      const data = dataMap[pid]
      if (data && hoverTurnIdx < data.length) {
        const x = padding.left + hoverTurnIdx * xStep
        const y = padding.top + chartH - (data[hoverTurnIdx] / yMax) * chartH
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = playerColors[pi]
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }
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

.search-bar {
  max-width: 600px;
  margin: 0 auto 16px;
  width: 100%;
}

.search-input {
  width: 100%;
  padding: 10px 16px;
  background: rgba(0,0,0,0.4);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  color: #ddd;
  font-size: 14px;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
}

.search-input:focus {
  border-color: rgba(78, 205, 196, 0.5);
  box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.1);
}

.search-input::placeholder {
  color: #666;
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
  position: relative;
}

.chart-wrapper canvas {
  width: 100%;
  height: 360px;
  display: block;
}

.chart-tooltip {
  position: absolute;
  background: rgba(0,0,0,0.9);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 8px;
  padding: 10px 12px;
  pointer-events: none;
  z-index: 10;
  min-width: 140px;
}

.tooltip-turn {
  font-size: 13px;
  font-weight: 600;
  color: #4ecdc4;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.tooltip-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 2px 0;
}

.tooltip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tooltip-name {
  color: #ccc;
  flex: 1;
}

.tooltip-value {
  color: #fff;
  font-weight: 600;
}

.turn-progress-section {
  max-width: 800px;
  margin: 0 auto 20px;
  width: 100%;
  background: rgba(0,0,0,0.4);
  border-radius: 10px;
  padding: 14px 20px;
  border: 1px solid rgba(255,255,255,0.06);
}

.turn-progress-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-size: 13px;
  color: #aaa;
}

.turn-current {
  color: #4ecdc4;
  font-weight: 600;
}

.turn-progress-bar {
  width: 100%;
}

.turn-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  background: rgba(255,255,255,0.1);
  border-radius: 3px;
  outline: none;
  cursor: pointer;
}

.turn-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  background: #e94560;
  border-radius: 50%;
  cursor: pointer;
  border: 3px solid #fff;
  box-shadow: 0 2px 6px rgba(0,0,0,0.4);
  transition: transform 0.15s;
}

.turn-slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.turn-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: #e94560;
  border-radius: 50%;
  cursor: pointer;
  border: 3px solid #fff;
  box-shadow: 0 2px 6px rgba(0,0,0,0.4);
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
  margin-bottom: 8px;
}

.casualty-bar-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 2px;
}

.casualty-bar {
  display: flex;
  width: 120px;
  height: 8px;
  background: rgba(255,255,255,0.05);
  border-radius: 4px;
  overflow: hidden;
}

.casualty-attacker {
  height: 100%;
  transition: width 0.2s;
}

.casualty-defender {
  height: 100%;
  transition: width 0.2s;
}

.casualty-label {
  font-size: 11px;
  color: #666;
}

.battle-pos {
  font-size: 11px;
  color: #666;
}
</style>
