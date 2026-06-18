import { HexCoord } from '../types';
import { HEX_DIRECTIONS, MAP_SIZE } from '../constants';

export function hexAdd(a: HexCoord, b: HexCoord): HexCoord {
  return { q: a.q + b.q, r: a.r + b.r };
}

export function hexSubtract(a: HexCoord, b: HexCoord): HexCoord {
  return { q: a.q - b.q, r: a.r - b.r };
}

export function hexScale(hex: HexCoord, scalar: number): HexCoord {
  return { q: hex.q * scalar, r: hex.r * scalar };
}

export function hexDirection(direction: number): HexCoord {
  return HEX_DIRECTIONS[direction % 6];
}

export function hexNeighbor(hex: HexCoord, direction: number): HexCoord {
  return hexAdd(hex, hexDirection(direction));
}

export function hexNeighbors(hex: HexCoord): HexCoord[] {
  return HEX_DIRECTIONS.map(dir => hexAdd(hex, dir));
}

export function hexDistance(a: HexCoord, b: HexCoord): number {
  const ac = -a.q - a.r;
  const bc = -b.q - b.r;
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(ac - bc));
}

export function hexLength(hex: HexCoord): number {
  const s = -hex.q - hex.r;
  return Math.max(Math.abs(hex.q), Math.abs(hex.r), Math.abs(s));
}

export function hexRing(center: HexCoord, radius: number): HexCoord[] {
  const results: HexCoord[] = [];
  if (radius === 0) {
    results.push({ ...center });
    return results;
  }

  let hex = hexAdd(center, hexScale(hexDirection(4), radius));

  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < radius; j++) {
      results.push(hex);
      hex = hexNeighbor(hex, i);
    }
  }

  return results;
}

export function hexRange(center: HexCoord, radius: number): HexCoord[] {
  const results: HexCoord[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      results.push({ q: center.q + q, r: center.r + r });
    }
  }
  return results;
}

export function hexLine(a: HexCoord, b: HexCoord): HexCoord[] {
  const distance = hexDistance(a, b);
  const results: HexCoord[] = [];
  const step = 1.0 / Math.max(distance, 1);

  for (let i = 0; i <= distance; i++) {
    results.push(hexRound(hexLerp(a, b, step * i)));
  }

  return results;
}

export function hexLerp(a: HexCoord, b: HexCoord, t: number): { q: number; r: number } {
  return {
    q: a.q + (b.q - a.q) * t,
    r: a.r + (b.r - a.r) * t
  };
}

export function hexRound(coord: { q: number; r: number }): HexCoord {
  const s = -coord.q - coord.r;
  let rq = Math.round(coord.q);
  let rr = Math.round(coord.r);
  const rs = Math.round(s);

  const qDiff = Math.abs(rq - coord.q);
  const rDiff = Math.abs(rr - coord.r);
  const sDiff = Math.abs(rs - s);

  if (qDiff > rDiff && qDiff > sDiff) {
    rq = -rr - rs;
  } else if (rDiff > sDiff) {
    rr = -rq - rs;
  }

  return { q: rq, r: rr };
}

export function isValidHex(hex: HexCoord, mapSize: number = MAP_SIZE): boolean {
  const offset = Math.floor(mapSize / 2);
  return (
    hex.q >= -offset &&
    hex.q < mapSize - offset &&
    hex.r >= -offset &&
    hex.r < mapSize - offset
  );
}

export function axialToOffset(hex: HexCoord): { col: number; row: number } {
  const col = hex.q + Math.floor(hex.r / 2);
  const row = hex.r;
  return { col, row };
}

export function offsetToAxial(col: number, row: number): HexCoord {
  const q = col - Math.floor(row / 2);
  const r = row;
  return { q, r };
}

export function pixelToHex(x: number, y: number, size: number): HexCoord {
  const q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / size;
  const r = (2 / 3 * y) / size;
  return hexRound({ q, r });
}

export function hexToPixel(hex: HexCoord, size: number): { x: number; y: number } {
  const x = size * (Math.sqrt(3) * hex.q + Math.sqrt(3) / 2 * hex.r);
  const y = size * (3 / 2 * hex.r);
  return { x, y };
}

export function getHexCorners(centerX: number, centerY: number, size: number): { x: number; y: number }[] {
  const corners: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    corners.push({
      x: centerX + size * Math.cos(angle),
      y: centerY + size * Math.sin(angle)
    });
  }
  return corners;
}
