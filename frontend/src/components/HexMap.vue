<template>
  <div class="hex-map-container" ref="containerRef" @wheel="handleZoom" @mousedown="startDrag" :class="{ 'readonly': readonly }">
    <div
      class="hex-map-wrapper"
      :style="wrapperStyle"
      ref="wrapperRef"
    >
      <svg
        :width="svgWidth"
        :height="svgHeight"
        class="hex-map-svg"
        @click="handleMapClick"
        @contextmenu.prevent="handleRightClick"
      >
        <defs>
          <pattern id="infoPheromonePattern" patternUnits="userSpaceOnUse" width="10" height="10">
            <rect width="10" height="10" fill="currentColor" opacity="0.3" />
          </pattern>
          <marker
            v-for="antType in (['worker', 'soldier', 'scout'] as AntType[])"
            :key="antType"
            :id="getArrowMarkerId(antType)"
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L9,3 z" :fill="antPathColors[antType]" />
          </marker>
        </defs>

        <g v-for="row in visibleRows" :key="'row-' + row.rowIndex" :transform="`translate(${row.offsetX}, ${row.offsetY})`">
          <g
            v-for="cell in row.cells"
            :key="`cell-${cell.coord.q}-${cell.coord.r}`"
            :transform="`translate(${cell.x}, ${cell.y})`"
            class="hex-cell"
            :class="{
              'is-selected': isCellSelected(cell),
              'is-target': isTargetCell(cell),
              'has-food': cell.terrain === 'food',
              'is-rock': cell.terrain === 'rock',
              'is-water': cell.terrain === 'water' || cell.temporaryWater,
              'readonly': props.readonly
            }"
          >
            <polygon
              :points="hexPoints"
              :fill="getCellFill(cell)"
              :stroke="getCellStroke(cell)"
              stroke-width="1"
              class="hex-polygon"
            />
            <polygon
              v-if="props.threatMatrix && props.threatMatrix[coordKey(cell.coord)] !== undefined"
              :points="hexPoints"
              :fill="getThreatColor(props.threatMatrix[coordKey(cell.coord)])"
              :opacity="getThreatOpacity(props.threatMatrix[coordKey(cell.coord)])"
              class="threat-overlay"
            />

            <circle
              v-if="cell.terrain === 'food' && cell.foodSource"
              cx="0"
              cy="0"
              :r="hexSize * 0.4"
              fill="#FFD93D"
              class="food-indicator"
            />
            <text
              v-if="cell.terrain === 'food' && cell.foodSource"
              x="0"
              y="4"
              text-anchor="middle"
              font-size="10"
              fill="#333"
              font-weight="bold"
            >{{ cell.foodSource.amount }}</text>

            <g v-if="cell.nest" class="nest-marker">
              <circle cx="0" cy="0" :r="hexSize * 0.5" :fill="getPlayerColor(cell.nest)" stroke="#fff" stroke-width="2" />
              <text x="0" y="4" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">巢</text>
            </g>
          </g>
        </g>

        <template v-for="player in players" :key="'ants-' + player.id">
          <g v-for="ant in getPlayerAnts(player)" :key="'ant-' + ant.id">
            <circle
              :cx="getAntX(ant)"
              :cy="getAntY(ant)"
              :r="getAntSize(ant)"
              :fill="player.color"
              :stroke="ant.type === 'soldier' ? '#ff6b6b' : ant.type === 'scout' ? '#4ecdc4' : '#ffd93d'"
              stroke-width="2"
              class="ant-marker"
              :class="{
                'ant-selected': isAntSelected(ant.id),
                'ant-worker': ant.type === 'worker',
                'ant-soldier': ant.type === 'soldier',
                'ant-scout': ant.type === 'scout'
              }"
              @click.stop="selectAnt(ant.id)"
            />
            <text
              :x="getAntX(ant)"
              :y="getAntY(ant) + 3"
              text-anchor="middle"
              font-size="8"
              fill="#fff"
              pointer-events="none"
            >{{ getAntIcon(ant.type) }}</text>
          </g>
        </template>

        <g v-if="predator" class="predator">
          <circle
            :cx="getHexX(predator.position)"
            :cy="getHexY(predator.position)"
            :r="hexSize * 0.6"
            fill="#8B0000"
            stroke="#FF4500"
            stroke-width="3"
          />
          <text
            :x="getHexX(predator.position)"
            :y="getHexY(predator.position) + 4"
            text-anchor="middle"
            font-size="14"
            fill="#fff"
          >🦗</text>
        </g>

        <path
          v-if="selectedAnts.length > 0 && moveTarget && !props.readonly"
          :d="movePathD"
          stroke="#4ecdc4"
          stroke-width="2"
          stroke-dasharray="5,5"
          fill="none"
          opacity="0.7"
        />

        <g v-if="props.antDecisions && props.antDecisions.length > 0" class="ant-paths">
          <path
            v-for="decision in props.antDecisions"
            :key="'path-' + decision.antId"
            :d="getPathD(decision.path)"
            :stroke="antPathColors[decision.antType]"
            stroke-width="2"
            fill="none"
            :marker-end="`url(#${getArrowMarkerId(decision.antType)})`"
            class="ant-move-path"
          />
        </g>
      </svg>
    </div>

    <div class="map-controls">
      <button class="btn control-btn" @click="zoomIn">+</button>
      <button class="btn control-btn" @click="zoomOut">−</button>
      <button class="btn control-btn" @click="resetView">⟲</button>
    </div>

    <div class="minimap">
      <div class="minimap-title">小地图</div>
      <canvas ref="minimapCanvas" :width="150" :height="150"></canvas>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useGameStore } from '@/stores/game'
import { storeToRefs } from 'pinia'
import type { HexCell, HexCoord, Ant, Player, Predator, ThreatMatrix, AntDecision, AntType } from '@shared/types'
import { hexToPixel, getHexCorners, hexDistance } from '@shared/utils/hex'

const props = defineProps<{
  hexSize?: number
  readonly?: boolean
  threatMatrix?: ThreatMatrix | null
  antDecisions?: AntDecision[]
  overrideMap?: HexCell[][]
  overridePlayers?: Player[]
  selectedAIPlayerId?: string
}>()

const emit = defineEmits<{
  (e: 'cellClick', coord: HexCoord, cell: HexCell): void
  (e: 'antClick', antId: string): void
  (e: 'rightClick', coord: HexCoord): void
}>()

const gameStore = useGameStore()
const { gameState, currentPlayer, selectedAnts, moveTarget } = storeToRefs(gameStore)

const containerRef = ref<HTMLDivElement | null>(null)
const wrapperRef = ref<HTMLDivElement | null>(null)
const minimapCanvas = ref<HTMLCanvasElement | null>(null)

const hexSize = ref(props.hexSize || 24)
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const lastPanX = ref(0)
const lastPanY = ref(0)

const wrapperStyle = computed(() => ({
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
  transformOrigin: 'center center'
}))

const hexPoints = computed(() => {
  const corners = getHexCorners(0, 0, hexSize.value)
  return corners.map(c => `${c.x},${c.y}`).join(' ')
})

const effectiveMap = computed(() => props.overrideMap || gameState.value?.map || [])
const effectiveMapSize = computed(() => {
  if (props.overrideMap) return props.overrideMap.length
  return gameState.value?.mapSize || 0
})
const players = computed(() => props.overridePlayers || gameState.value?.players || [])
const predator = computed(() => gameState.value?.predator as Predator | undefined)

const visibleRows = computed(() => {
  const map = effectiveMap.value
  if (!map || map.length === 0) return []
  const offset = Math.floor(effectiveMapSize.value / 2)

  return map.map((row, rowIndex) => {
    const r = rowIndex - offset
    const cells = row.map(cell => {
      const pixel = hexToPixel(cell.coord, hexSize.value)
      return {
        ...cell,
        x: pixel.x,
        y: pixel.y
      }
    })

    return {
      rowIndex,
      r,
      cells,
      offsetX: 0,
      offsetY: 0
    }
  })
})

const svgWidth = computed(() => {
  const size = effectiveMapSize.value
  if (!size) return 800
  return size * hexSize.value * 1.8
})

const svgHeight = computed(() => {
  const size = effectiveMapSize.value
  if (!size) return 600
  return size * hexSize.value * 1.6
})

function getThreatColor(threat: number): string {
  const normalized = Math.min(1, Math.max(0, threat / 10))
  const r = Math.round(30 + normalized * 205)
  const g = Math.round(100 - normalized * 80)
  const b = Math.round(200 - normalized * 150)
  return `rgba(${r}, ${g}, ${b}, 0.5)`
}

function getThreatOpacity(threat: number): number {
  return Math.min(0.7, Math.max(0.1, threat / 15))
}

function coordKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`
}

const antPathColors: Record<AntType, string> = {
  worker: '#22c55e',
  soldier: '#ef4444',
  scout: '#eab308'
}

function getPathD(path: HexCoord[]): string {
  if (path.length < 2) return ''
  const points = path.map(p => hexToPixel(p, hexSize.value))
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i].x} ${points[i].y}`
  }
  return d
}

function getArrowMarkerId(antType: AntType): string {
  return `arrow-${antType}`
}

const movePathD = computed(() => {
  if (selectedAnts.value.length === 0 || !moveTarget.value || !currentPlayer.value) return ''

  const firstAnt = currentPlayer.value.ants.find(a => a.id === selectedAnts.value[0])
  if (!firstAnt) return ''

  const start = hexToPixel(firstAnt.position, hexSize.value)
  const end = hexToPixel(moveTarget.value, hexSize.value)

  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`
})

function getCellFill(cell: HexCell): string {
  const territoryOwner = getTerritoryOwner(cell)

  if (cell.terrain === 'rock') {
    return '#4a4a4a'
  }

  if (cell.terrain === 'water' || cell.temporaryWater) {
    return cell.temporaryWater ? '#5DADE2' : '#3498db'
  }

  let baseColor = '#2d3436'

  if (territoryOwner) {
    const color = getPlayerColor(territoryOwner)
    const intensity = Math.min(cell.territoryMarkers[territoryOwner] || 0, 3) / 3
    return mixColors(baseColor, color, intensity * 0.4)
  }

  return baseColor
}

function getCellStroke(cell: HexCell): string {
  if (cell.terrain === 'rock') return '#333'
  if (cell.terrain === 'water') return '#2980b9'
  return '#3d3d3d'
}

function getTerritoryOwner(cell: HexCell): string | null {
  let maxPlayer: string | null = null
  let maxValue = 0.1

  for (const [playerId, value] of Object.entries(cell.territoryMarkers)) {
    if (value > maxValue) {
      maxValue = value
      maxPlayer = playerId
    }
  }

  return maxPlayer
}

function getPlayerColor(playerId: string): string {
  const player = players.value.find(p => p.id === playerId)
  return player?.color || '#888'
}

function mixColors(color1: string, color2: string, ratio: number): string {
  const r1 = parseInt(color1.slice(1, 3), 16)
  const g1 = parseInt(color1.slice(3, 5), 16)
  const b1 = parseInt(color1.slice(5, 7), 16)

  const r2 = parseInt(color2.slice(1, 3), 16)
  const g2 = parseInt(color2.slice(3, 5), 16)
  const b2 = parseInt(color2.slice(5, 7), 16)

  const r = Math.round(r1 + (r2 - r1) * ratio)
  const g = Math.round(g1 + (g2 - g1) * ratio)
  const b = Math.round(b1 + (b2 - b1) * ratio)

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function getHexX(coord: HexCoord): number {
  return hexToPixel(coord, hexSize.value).x
}

function getHexY(coord: HexCoord): number {
  return hexToPixel(coord, hexSize.value).y
}

function getAntX(ant: Ant): number {
  return getHexX(ant.position)
}

function getAntY(ant: Ant): number {
  return getHexY(ant.position) - (ant.type === 'soldier' ? 5 : 0)
}

function getAntSize(ant: Ant): number {
  if (ant.type === 'soldier') return hexSize.value * 0.35
  if (ant.type === 'scout') return hexSize.value * 0.2
  return hexSize.value * 0.25
}

function getAntIcon(type: string): string {
  if (type === 'soldier') return '⚔'
  if (type === 'scout') return '👁'
  return '🐜'
}

function getPlayerAnts(player: Player): Ant[] {
  return player.ants.filter(a => a.hp > 0)
}

function isCellSelected(cell: HexCell): boolean {
  return moveTarget.value?.q === cell.coord.q && moveTarget.value?.r === cell.coord.r
}

function isTargetCell(cell: HexCell): boolean {
  return false
}

function isAntSelected(antId: string): boolean {
  return selectedAnts.value.includes(antId)
}

function selectAnt(antId: string) {
  if (props.readonly) return
  const ant = currentPlayer.value?.ants.find(a => a.id === antId)
  if (ant && ant.playerId === gameStore.playerId) {
    gameStore.selectAnt(antId, false)
    emit('antClick', antId)
  }
}

function handleMapClick(event: MouseEvent) {
  if (props.readonly) return
  if (!wrapperRef.value || !effectiveMap.value) return

  const rect = wrapperRef.value.getBoundingClientRect()
  const x = (event.clientX - rect.left) / zoom.value - svgWidth.value / 2
  const y = (event.clientY - rect.top) / zoom.value - svgHeight.value / 2

  const coord = pixelToHex(x, y, hexSize.value)
  const cell = getCellAt(coord)

  if (cell) {
    emit('cellClick', coord, cell)
  }
}

function handleRightClick(event: MouseEvent) {
  if (props.readonly) return
  if (!wrapperRef.value || !effectiveMap.value) return

  const rect = wrapperRef.value.getBoundingClientRect()
  const x = (event.clientX - rect.left) / zoom.value - svgWidth.value / 2
  const y = (event.clientY - rect.top) / zoom.value - svgHeight.value / 2

  const coord = pixelToHex(x, y, hexSize.value)
  emit('rightClick', coord)
}

function pixelToHex(x: number, y: number, size: number): HexCoord {
  const q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / size
  const r = (2 / 3 * y) / size
  return hexRound({ q, r })
}

function hexRound(coord: { q: number; r: number }): HexCoord {
  const s = -coord.q - coord.r
  let rq = Math.round(coord.q)
  let rr = Math.round(coord.r)
  const rs = Math.round(s)

  const qDiff = Math.abs(rq - coord.q)
  const rDiff = Math.abs(rr - coord.r)
  const sDiff = Math.abs(rs - s)

  if (qDiff > rDiff && qDiff > sDiff) {
    rq = -rr - rs
  } else if (rDiff > sDiff) {
    rr = -rq - rs
  }

  return { q: rq, r: rr }
}

function getCellAt(coord: HexCoord): HexCell | null {
  const map = effectiveMap.value
  const mapSize = effectiveMapSize.value
  if (!map || map.length === 0) return null
  const offset = Math.floor(mapSize / 2)

  const rowIdx = coord.r + offset
  if (rowIdx < 0 || rowIdx >= map.length) return null

  const colIdx = coord.q + offset - Math.floor(coord.r / 2)
  const row = map[rowIdx]
  if (colIdx < 0 || colIdx >= row.length) return null

  return row[colIdx]
}

function handleZoom(event: WheelEvent) {
  event.preventDefault()
  const delta = event.deltaY > 0 ? -0.1 : 0.1
  const newZoom = Math.max(0.3, Math.min(3, zoom.value + delta))
  zoom.value = newZoom
}

function zoomIn() {
  zoom.value = Math.min(3, zoom.value + 0.2)
}

function zoomOut() {
  zoom.value = Math.max(0.3, zoom.value - 0.2)
}

function resetView() {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

function startDrag(event: MouseEvent) {
  if (props.readonly) return
  if (event.button !== 0 && event.button !== 1) return
  isDragging.value = true
  dragStartX.value = event.clientX
  dragStartY.value = event.clientY
  lastPanX.value = panX.value
  lastPanY.value = panY.value

  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', endDrag)
}

function onDrag(event: MouseEvent) {
  if (!isDragging.value) return
  const dx = event.clientX - dragStartX.value
  const dy = event.clientY - dragStartY.value
  panX.value = lastPanX.value + dx
  panY.value = lastPanY.value + dy
}

function endDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', endDrag)
}

function drawMinimap() {
  if (!minimapCanvas.value) return
  const map = effectiveMap.value
  if (!map || map.length === 0) return
  const ctx = minimapCanvas.value.getContext('2d')
  if (!ctx) return

  const canvasSize = 150
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, canvasSize, canvasSize)

  const cellSize = canvasSize / (map.length * 1.2)

  for (let r = 0; r < map.length; r++) {
    const row = map[r]
    for (let q = 0; q < row.length; q++) {
      const cell = row[q]
      const px = (q + r * 0.5) * cellSize + 10
      const py = r * cellSize * 0.87 + 10

      if (cell.terrain === 'rock') {
        ctx.fillStyle = '#4a4a4a'
      } else if (cell.terrain === 'water' || cell.temporaryWater) {
        ctx.fillStyle = '#3498db'
      } else if (cell.terrain === 'food') {
        ctx.fillStyle = '#FFD93D'
      } else {
        const owner = getTerritoryOwner(cell)
        if (owner) {
          ctx.fillStyle = getPlayerColor(owner) + '60'
        } else {
          ctx.fillStyle = '#2d3436'
        }
      }

      ctx.fillRect(px, py, cellSize * 0.9, cellSize * 0.9)
    }
  }
}

onMounted(() => {
  nextTick(() => {
    if (containerRef.value && effectiveMapSize.value > 0) {
      const size = effectiveMapSize.value
      const optimalZoom = Math.min(
        containerRef.value.clientWidth / (size * hexSize.value * 1.8),
        containerRef.value.clientHeight / (size * hexSize.value * 1.6),
        1
      )
      zoom.value = Math.max(0.5, optimalZoom)
    }
    drawMinimap()
  })
})

watch([gameState, () => props.overrideMap, () => props.threatMatrix, () => props.antDecisions], () => {
  drawMinimap()
}, { deep: true })
</script>

<style scoped>
.hex-map-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #0a0a0f;
  cursor: grab;
}

.hex-map-container:active {
  cursor: grabbing;
}

.hex-map-wrapper {
  position: absolute;
  top: 50%;
  left: 50%;
  transform-origin: center center;
  will-change: transform;
}

.hex-map-svg {
  display: block;
  transform: translate(-50%, -50%);
}

.hex-cell {
  cursor: pointer;
  transition: all 0.15s ease;
}

.hex-polygon {
  transition: all 0.15s ease;
}

.hex-cell:hover .hex-polygon {
  filter: brightness(1.3);
}

.is-selected .hex-polygon {
  stroke: #4ecdc4 !important;
  stroke-width: 2 !important;
}

.is-target .hex-polygon {
  stroke: #e94560 !important;
  stroke-width: 2 !important;
}

.food-indicator {
  pointer-events: none;
}

.nest-marker {
  pointer-events: none;
}

.ant-marker {
  cursor: pointer;
  transition: all 0.15s ease;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
}

.ant-marker:hover {
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.7)) brightness(1.2);
}

.ant-selected {
  stroke: #fff !important;
  stroke-width: 3 !important;
  filter: drop-shadow(0 0 6px rgba(255,255,255,0.6));
}

.predator {
  pointer-events: none;
}

.map-controls {
  position: absolute;
  bottom: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 10;
}

.control-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  padding: 0;
}

.minimap {
  position: absolute;
  bottom: 20px;
  left: 20px;
  background: rgba(0,0,0,0.7);
  border-radius: 8px;
  padding: 8px;
  z-index: 10;
}

.minimap-title {
  font-size: 11px;
  color: #888;
  margin-bottom: 6px;
  text-align: center;
}

.minimap canvas {
  border-radius: 4px;
}

.hex-cell.readonly {
  cursor: default;
}

.hex-cell.readonly:hover .hex-polygon {
  filter: none;
}

.threat-overlay {
  transition: fill 0.5s ease, opacity 0.5s ease;
  pointer-events: none;
}

.ant-move-path {
  transition: stroke-dashoffset 0.5s ease;
  pointer-events: none;
  animation: pathDash 0.5s ease-out;
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
}

@keyframes pathDash {
  to {
    stroke-dashoffset: 0;
  }
}

.ant-marker {
  transition: cx 0.5s ease, cy 0.5s ease;
}

.hex-polygon {
  transition: fill 0.5s ease, stroke 0.5s ease;
}

.hex-map-container.readonly {
  cursor: default;
}

.hex-map-container.readonly:active {
  cursor: default;
}
</style>
