<template>
  <div class="ai-replay-container" @keydown="handleKeydown" tabindex="0" ref="containerRef">
    <div class="replay-header">
      <div class="header-left">
        <button class="btn btn-secondary back-btn" @click="$emit('back')">
          ← 返回结算
        </button>
        <h2 class="replay-title">🤖 AI决策复盘分析</h2>
      </div>
      <div class="header-right">
        <div class="ai-selector">
          <label>选择AI玩家:</label>
          <select v-model="selectedAIPlayerId" class="ai-select">
            <option v-for="aiData in aiReplayData" :key="aiData.playerId" :value="aiData.playerId">
              {{ aiData.playerName }}
            </option>
          </select>
        </div>
        <button 
          class="btn autoplay-btn" 
          :class="{ 'is-playing': isAutoPlaying }"
          @click="toggleAutoPlay"
        >
          {{ isAutoPlaying ? '⏸ 暂停' : '▶ 自动播放' }}
        </button>
      </div>
    </div>

    <div class="turn-progress-section">
      <div class="turn-info">
        <span class="turn-label">回合</span>
        <span class="turn-number">{{ currentTurn + 1 }} / {{ totalTurns }}</span>
      </div>
      <div class="progress-bar-wrapper">
        <input
          type="range"
          :min="0"
          :max="totalTurns - 1"
          :value="currentTurn"
          @input="handleProgressChange"
          class="turn-slider"
        />
        <div class="turn-markers">
          <span 
            v-for="turn in totalTurns" 
            :key="turn"
            class="turn-marker"
            @click="jumpToTurn(turn - 1)"
          >
            {{ turn }}
          </span>
        </div>
      </div>
      <div class="turn-controls">
        <button class="btn btn-small" @click="prevTurn" :disabled="currentTurn === 0">
          ← 上一回合
        </button>
        <button class="btn btn-small" @click="nextTurn" :disabled="currentTurn === totalTurns - 1">
          下一回合 →
        </button>
      </div>
    </div>

    <div class="replay-content">
      <div class="map-panel">
        <div class="panel-header">
          <h3>地图状态</h3>
          <div class="legend">
            <div class="legend-item">
              <span class="legend-color worker"></span>
              <span>工蚁路径</span>
            </div>
            <div class="legend-item">
              <span class="legend-color soldier"></span>
              <span>士兵路径</span>
            </div>
            <div class="legend-item">
              <span class="legend-color scout"></span>
              <span>侦察蚁路径</span>
            </div>
            <div class="legend-item threat-legend">
              <span class="threat-gradient"></span>
              <span>威胁度: 低 → 高</span>
            </div>
          </div>
        </div>
        <div class="map-wrapper">
          <HexMap
            v-if="currentDecision"
            :readonly="true"
            :override-map="currentDecision.mapSnapshot"
            :override-players="replayPlayers"
            :threat-matrix="currentDecision.threatMatrix"
            :ant-decisions="currentDecision.antDecisions"
            :hex-size="20"
          />
          <div v-else class="loading">加载中...</div>
        </div>
      </div>

      <div class="decision-panel">
        <div class="panel-header">
          <h3>AI决策详情</h3>
          <span class="turn-badge">第 {{ currentTurn + 1 }} 回合</span>
        </div>

        <div v-if="currentDecision" class="decision-content">
          <div class="resource-allocation section">
            <h4>资源分配比例</h4>
            <div class="allocation-content">
              <div class="donut-chart">
                <svg width="140" height="140" viewBox="0 0 140 140">
                  <circle
                    cx="70"
                    cy="70"
                    r="55"
                    fill="none"
                    stroke="#2d3748"
                    stroke-width="20"
                  />
                  <circle
                    cx="70"
                    cy="70"
                    r="55"
                    fill="none"
                    :stroke="militaryColor"
                    stroke-width="20"
                    :stroke-dasharray="militaryDashArray"
                    stroke-dashoffset="0"
                    transform="rotate(-90 70 70)"
                    class="donut-segment"
                  />
                  <text x="70" y="65" text-anchor="middle" class="donut-label">
                    {{ (currentDecision.militaryRatio * 100).toFixed(0) }}%
                  </text>
                  <text x="70" y="82" text-anchor="middle" class="donut-subtitle">
                    军事
                  </text>
                </svg>
              </div>
              <div class="allocation-details">
                <div class="allocation-item military">
                  <span class="allocation-label">军事投入</span>
                  <span class="allocation-value">{{ (currentDecision.militaryRatio * 100).toFixed(1) }}%</span>
                </div>
                <div class="allocation-item economic">
                  <span class="allocation-label">经济投入</span>
                  <span class="allocation-value">{{ (currentDecision.economicRatio * 100).toFixed(1) }}%</span>
                </div>
                <div class="calc-details">
                  <div class="calc-item">
                    <span>威胁指数:</span>
                    <span>{{ currentDecision.militaryRatioCalc.threatIndex.toFixed(3) }}</span>
                  </div>
                  <div class="calc-item">
                    <span>邻居攻击性:</span>
                    <span>{{ currentDecision.militaryRatioCalc.neighborAggression.toFixed(3) }}</span>
                  </div>
                  <div class="calc-item">
                    <span>高威胁格子:</span>
                    <span>{{ currentDecision.militaryRatioCalc.highThreatCount }} / {{ currentDecision.militaryRatioCalc.totalTerritoryCount }}</span>
                  </div>
                  <div class="calc-item">
                    <span>维护成本:</span>
                    <span>{{ currentDecision.militaryRatioCalc.maintenanceCost }}</span>
                  </div>
                  <div class="calc-item">
                    <span>当前食物:</span>
                    <span>{{ currentDecision.militaryRatioCalc.foodLevel }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="ant-decisions section">
            <h4>蚂蚁移动决策 ({{ currentDecision.antDecisions.length }}只)</h4>
            <div class="ant-list">
              <div 
                v-for="decision in currentDecision.antDecisions" 
                :key="decision.antId"
                class="ant-decision-item"
                :class="decision.antType"
              >
                <div class="ant-icon">
                  {{ getAntIcon(decision.antType) }}
                </div>
                <div class="ant-info">
                  <div class="ant-header">
                    <span class="ant-type">{{ getAntTypeName(decision.antType) }}</span>
                    <span class="ant-reason">{{ getReasonName(decision.reason) }}</span>
                  </div>
                  <div class="ant-detail">{{ decision.reasonDetail }}</div>
                  <div class="ant-path">
                    路径: ({{ decision.startPosition.q }},{{ decision.startPosition.r }}) → ({{ decision.targetPosition.q }},{{ decision.targetPosition.r }})
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="production-decisions section" v-if="currentDecision.produceDecisions.length > 0">
            <h4>生产决策</h4>
            <div class="decision-list">
              <div 
                v-for="(decision, idx) in currentDecision.produceDecisions" 
                :key="idx"
                class="decision-item produce"
              >
                <div class="decision-icon">🏭</div>
                <div class="decision-info">
                  <div class="decision-title">
                    生产 {{ decision.count }} 只{{ getAntTypeName(decision.antType) }}
                  </div>
                  <div class="decision-cost">消耗: {{ decision.cost }} 食物</div>
                  <div class="decision-condition">{{ decision.triggerCondition }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="upgrade-decisions section" v-if="currentDecision.upgradeDecisions.length > 0">
            <h4>升级决策</h4>
            <div class="decision-list">
              <div 
                v-for="(decision, idx) in currentDecision.upgradeDecisions" 
                :key="idx"
                class="decision-item upgrade"
              >
                <div class="decision-icon">⬆️</div>
                <div class="decision-info">
                  <div class="decision-title">
                    升级 {{ getFacilityName(decision.facilityType) }}: {{ decision.fromLevel }} → {{ decision.toLevel }}
                  </div>
                  <div class="decision-cost">消耗: {{ decision.cost }} 食物</div>
                  <div class="decision-condition">{{ decision.triggerCondition }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="status-summary section">
            <h4>当前状态</h4>
            <div class="status-grid">
              <div class="status-item">
                <span class="status-label">食物</span>
                <span class="status-value food">{{ currentDecision.totalFood }}</span>
              </div>
              <div class="status-item">
                <span class="status-label">工蚁</span>
                <span class="status-value worker">{{ currentDecision.playerSnapshot.workerCount }}</span>
              </div>
              <div class="status-item">
                <span class="status-label">士兵</span>
                <span class="status-value soldier">{{ currentDecision.playerSnapshot.soldierCount }}</span>
              </div>
              <div class="status-item">
                <span class="status-label">侦察蚁</span>
                <span class="status-value scout">{{ currentDecision.playerSnapshot.scoutCount }}</span>
              </div>
              <div class="status-item">
                <span class="status-label">领地</span>
                <span class="status-value territory">{{ currentDecision.playerSnapshot.territoryCount }}</span>
              </div>
              <div class="status-item">
                <span class="status-label">孵化场</span>
                <span class="status-value">Lv.{{ currentDecision.playerSnapshot.hatcheryLevel }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="loading">加载中...</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import HexMap from './HexMap.vue'
import type { GameReplayWithAI, AIReplayData, AITurnDecision, AntType, AntDecisionReason, FacilityType, Player } from '@shared/types'

const props = defineProps<{
  replayData: GameReplayWithAI
}>()

defineEmits<{
  (e: 'back'): void
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const currentTurn = ref(0)
const isAutoPlaying = ref(false)
const selectedAIPlayerId = ref('')
let autoPlayTimer: number | null = null

const aiReplayData = computed(() => props.replayData.aiReplayData || [])

const totalTurns = computed(() => {
  if (aiReplayData.value.length === 0) return 0
  return aiReplayData.value[0].decisions.length
})

const replayPlayers = computed((): Player[] => {
  return props.replayData.playerIds.map((id, idx) => ({
    id,
    name: props.replayData.playerNames[idx],
    color: props.replayData.playerColors[idx]
  } as Player))
})

const selectedAI = computed((): AIReplayData | undefined => {
  return aiReplayData.value.find(ai => ai.playerId === selectedAIPlayerId.value)
})

const currentDecision = computed((): AITurnDecision | undefined => {
  if (!selectedAI.value) return undefined
  return selectedAI.value.decisions[currentTurn.value]
})

const militaryColor = computed(() => '#ef4444')
const economicColor = computed(() => '#22c55e')

const militaryDashArray = computed(() => {
  if (!currentDecision.value) return '0 345.6'
  const circumference = 2 * Math.PI * 55
  const militaryLength = circumference * currentDecision.value.militaryRatio
  return `${militaryLength} ${circumference}`
})

watch(() => props.replayData, (newData) => {
  if (newData && newData.aiReplayData && newData.aiReplayData.length > 0) {
    selectedAIPlayerId.value = newData.aiReplayData[0].playerId
    currentTurn.value = 0
  }
}, { immediate: true })

function handleProgressChange(event: Event) {
  const target = event.target as HTMLInputElement
  currentTurn.value = parseInt(target.value)
}

function jumpToTurn(turn: number) {
  currentTurn.value = turn
}

function prevTurn() {
  if (currentTurn.value > 0) {
    currentTurn.value--
  }
}

function nextTurn() {
  if (currentTurn.value < totalTurns.value - 1) {
    currentTurn.value++
  }
}

function toggleAutoPlay() {
  isAutoPlaying.value = !isAutoPlaying.value
  if (isAutoPlaying.value) {
    startAutoPlay()
  } else {
    stopAutoPlay()
  }
}

function startAutoPlay() {
  stopAutoPlay()
  autoPlayTimer = window.setInterval(() => {
    if (currentTurn.value < totalTurns.value - 1) {
      currentTurn.value++
    } else {
      stopAutoPlay()
      isAutoPlaying.value = false
    }
  }, 2000)
}

function stopAutoPlay() {
  if (autoPlayTimer) {
    clearInterval(autoPlayTimer)
    autoPlayTimer = null
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    prevTurn()
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    nextTurn()
  } else if (event.key === ' ') {
    event.preventDefault()
    toggleAutoPlay()
  }
}

function getAntIcon(type: AntType): string {
  if (type === 'soldier') return '⚔'
  if (type === 'scout') return '👁'
  return '🐜'
}

function getAntTypeName(type: AntType): string {
  const names: Record<AntType, string> = {
    worker: '工蚁',
    soldier: '士兵',
    scout: '侦察蚁'
  }
  return names[type]
}

function getReasonName(reason: AntDecisionReason): string {
  const names: Record<AntDecisionReason, string> = {
    patrol: '巡逻',
    chase: '追击',
    collect: '采集',
    return: '返回',
    explore: '探索',
    defend: '防御'
  }
  return names[reason]
}

function getFacilityName(type: FacilityType): string {
  const names: Record<FacilityType, string> = {
    hatchery: '孵化场',
    storage: '仓库',
    barracks: '兵营',
    lab: '实验室'
  }
  return names[type]
}

onMounted(() => {
  nextTick(() => {
    containerRef.value?.focus()
  })
})

onUnmounted(() => {
  stopAutoPlay()
})
</script>

<style scoped>
.ai-replay-container {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #0a0a0f;
  color: #e0e0e0;
  outline: none;
  overflow: hidden;
}

.replay-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: linear-gradient(180deg, #16213e 0%, #0f3460 100%);
  border-bottom: 2px solid #e94560;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.back-btn {
  padding: 8px 16px;
  font-size: 14px;
}

.replay-title {
  margin: 0;
  font-size: 20px;
  color: #4ecdc4;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.ai-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ai-selector label {
  font-size: 14px;
  color: #aaa;
}

.ai-select {
  padding: 8px 12px;
  background: #2d3748;
  border: 1px solid #4a5568;
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}

.autoplay-btn {
  padding: 8px 16px;
  font-size: 14px;
  background: linear-gradient(180deg, #4ecdc4 0%, #2d9a94 100%);
  border: none;
  color: #1a1a2e;
  font-weight: 600;
  transition: all 0.2s ease;
}

.autoplay-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(78, 205, 196, 0.4);
}

.autoplay-btn.is-playing {
  background: linear-gradient(180deg, #e94560 0%, #c73e54 100%);
  color: #fff;
}

.turn-progress-section {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.turn-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 80px;
}

.turn-label {
  font-size: 12px;
  color: #888;
}

.turn-number {
  font-size: 24px;
  font-weight: bold;
  color: #e94560;
}

.progress-bar-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.turn-slider {
  width: 100%;
  height: 8px;
  -webkit-appearance: none;
  appearance: none;
  background: #2d3748;
  border-radius: 4px;
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
  transition: all 0.2s ease;
}

.turn-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
  box-shadow: 0 0 10px rgba(233, 69, 96, 0.6);
}

.turn-markers {
  display: flex;
  justify-content: space-between;
  padding: 0 8px;
}

.turn-marker {
  font-size: 10px;
  color: #666;
  cursor: pointer;
  transition: color 0.2s ease;
  user-select: none;
}

.turn-marker:hover {
  color: #4ecdc4;
}

.turn-controls {
  display: flex;
  gap: 8px;
}

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
  min-width: 90px;
}

.replay-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.map-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.decision-panel {
  width: 420px;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.02);
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  color: #4ecdc4;
}

.turn-badge {
  background: #e94560;
  color: #fff;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.legend {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #aaa;
}

.legend-color {
  width: 16px;
  height: 3px;
  border-radius: 2px;
}

.legend-color.worker { background: #22c55e; }
.legend-color.soldier { background: #ef4444; }
.legend-color.scout { background: #eab308; }

.threat-legend {
  gap: 8px;
}

.threat-gradient {
  width: 60px;
  height: 8px;
  border-radius: 4px;
  background: linear-gradient(90deg, #1e3a8a, #ef4444);
}

.map-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #888;
  font-size: 16px;
}

.decision-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.section {
  margin-bottom: 24px;
}

.section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #ffd93d;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 217, 61, 0.3);
}

.resource-allocation .allocation-content {
  display: flex;
  gap: 20px;
  align-items: center;
}

.donut-chart {
  flex-shrink: 0;
}

.donut-segment {
  transition: stroke-dasharray 0.5s ease;
}

.donut-label {
  font-size: 20px;
  font-weight: bold;
  fill: #fff;
}

.donut-subtitle {
  font-size: 10px;
  fill: #888;
}

.allocation-details {
  flex: 1;
}

.allocation-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
}

.allocation-item.military .allocation-value {
  color: #ef4444;
  font-weight: 600;
}

.allocation-item.economic .allocation-value {
  color: #22c55e;
  font-weight: 600;
}

.calc-details {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.calc-item {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 12px;
  color: #aaa;
}

.calc-item span:last-child {
  color: #fff;
  font-family: monospace;
}

.ant-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.ant-decision-item {
  display: flex;
  gap: 12px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border-left: 3px solid;
  transition: all 0.2s ease;
}

.ant-decision-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.ant-decision-item.worker {
  border-left-color: #22c55e;
}

.ant-decision-item.soldier {
  border-left-color: #ef4444;
}

.ant-decision-item.scout {
  border-left-color: #eab308;
}

.ant-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.ant-info {
  flex: 1;
  min-width: 0;
}

.ant-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.ant-type {
  font-weight: 600;
  font-size: 13px;
}

.ant-reason {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  color: #4ecdc4;
}

.ant-detail {
  font-size: 12px;
  color: #aaa;
  margin-bottom: 4px;
}

.ant-path {
  font-size: 11px;
  color: #666;
  font-family: monospace;
}

.decision-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.decision-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.decision-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.decision-item.produce {
  border-left: 3px solid #22c55e;
}

.decision-item.upgrade {
  border-left: 3px solid #eab308;
}

.decision-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.decision-info {
  flex: 1;
}

.decision-title {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 4px;
}

.decision-cost {
  font-size: 12px;
  color: #eab308;
  margin-bottom: 4px;
}

.decision-condition {
  font-size: 11px;
  color: #888;
  font-style: italic;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.status-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
}

.status-label {
  font-size: 11px;
  color: #888;
  margin-bottom: 4px;
}

.status-value {
  font-size: 18px;
  font-weight: bold;
}

.status-value.food { color: #ffd93d; }
.status-value.worker { color: #22c55e; }
.status-value.soldier { color: #ef4444; }
.status-value.scout { color: #eab308; }
.status-value.territory { color: #4ecdc4; }

.decision-content::-webkit-scrollbar {
  width: 6px;
}

.decision-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

.decision-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: linear-gradient(180deg, #4a5568 0%, #2d3748 100%);
  color: #fff;
  border: 1px solid #718096;
}

.btn-secondary:hover:not(:disabled) {
  background: linear-gradient(180deg, #5a6578 0%, #3d4758 100%);
  transform: translateY(-1px);
}

.btn-primary {
  background: linear-gradient(180deg, #e94560 0%, #c73e54 100%);
  color: #fff;
  border: 1px solid #e94560;
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(180deg, #ff5a75 0%, #e94560 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(233, 69, 96, 0.4);
}
</style>
