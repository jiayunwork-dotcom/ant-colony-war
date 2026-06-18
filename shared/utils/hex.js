"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hexAdd = hexAdd;
exports.hexSubtract = hexSubtract;
exports.hexScale = hexScale;
exports.hexDirection = hexDirection;
exports.hexNeighbor = hexNeighbor;
exports.hexNeighbors = hexNeighbors;
exports.hexDistance = hexDistance;
exports.hexLength = hexLength;
exports.hexRing = hexRing;
exports.hexRange = hexRange;
exports.hexLine = hexLine;
exports.hexLerp = hexLerp;
exports.hexRound = hexRound;
exports.isValidHex = isValidHex;
exports.axialToOffset = axialToOffset;
exports.offsetToAxial = offsetToAxial;
exports.pixelToHex = pixelToHex;
exports.hexToPixel = hexToPixel;
exports.getHexCorners = getHexCorners;
const constants_1 = require("../constants");
function hexAdd(a, b) {
    return { q: a.q + b.q, r: a.r + b.r };
}
function hexSubtract(a, b) {
    return { q: a.q - b.q, r: a.r - b.r };
}
function hexScale(hex, scalar) {
    return { q: hex.q * scalar, r: hex.r * scalar };
}
function hexDirection(direction) {
    return constants_1.HEX_DIRECTIONS[direction % 6];
}
function hexNeighbor(hex, direction) {
    return hexAdd(hex, hexDirection(direction));
}
function hexNeighbors(hex) {
    return constants_1.HEX_DIRECTIONS.map(dir => hexAdd(hex, dir));
}
function hexDistance(a, b) {
    const ac = -a.q - a.r;
    const bc = -b.q - b.r;
    return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(ac - bc));
}
function hexLength(hex) {
    const s = -hex.q - hex.r;
    return Math.max(Math.abs(hex.q), Math.abs(hex.r), Math.abs(s));
}
function hexRing(center, radius) {
    const results = [];
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
function hexRange(center, radius) {
    const results = [];
    for (let q = -radius; q <= radius; q++) {
        for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
            results.push({ q: center.q + q, r: center.r + r });
        }
    }
    return results;
}
function hexLine(a, b) {
    const distance = hexDistance(a, b);
    const results = [];
    const step = 1.0 / Math.max(distance, 1);
    for (let i = 0; i <= distance; i++) {
        results.push(hexRound(hexLerp(a, b, step * i)));
    }
    return results;
}
function hexLerp(a, b, t) {
    return {
        q: a.q + (b.q - a.q) * t,
        r: a.r + (b.r - a.r) * t
    };
}
function hexRound(coord) {
    const s = -coord.q - coord.r;
    let rq = Math.round(coord.q);
    let rr = Math.round(coord.r);
    const rs = Math.round(s);
    const qDiff = Math.abs(rq - coord.q);
    const rDiff = Math.abs(rr - coord.r);
    const sDiff = Math.abs(rs - s);
    if (qDiff > rDiff && qDiff > sDiff) {
        rq = -rr - rs;
    }
    else if (rDiff > sDiff) {
        rr = -rq - rs;
    }
    return { q: rq, r: rr };
}
function isValidHex(hex, mapSize = constants_1.MAP_SIZE) {
    const offset = Math.floor(mapSize / 2);
    return (hex.q >= -offset &&
        hex.q < mapSize - offset &&
        hex.r >= -offset &&
        hex.r < mapSize - offset);
}
function axialToOffset(hex) {
    const col = hex.q + Math.floor(hex.r / 2);
    const row = hex.r;
    return { col, row };
}
function offsetToAxial(col, row) {
    const q = col - Math.floor(row / 2);
    const r = row;
    return { q, r };
}
function pixelToHex(x, y, size) {
    const q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / size;
    const r = (2 / 3 * y) / size;
    return hexRound({ q, r });
}
function hexToPixel(hex, size) {
    const x = size * (Math.sqrt(3) * hex.q + Math.sqrt(3) / 2 * hex.r);
    const y = size * (3 / 2 * hex.r);
    return { x, y };
}
function getHexCorners(centerX, centerY, size) {
    const corners = [];
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i - 30);
        corners.push({
            x: centerX + size * Math.cos(angle),
            y: centerY + size * Math.sin(angle)
        });
    }
    return corners;
}
