import { HexCoord } from '../types';
export declare function hexAdd(a: HexCoord, b: HexCoord): HexCoord;
export declare function hexSubtract(a: HexCoord, b: HexCoord): HexCoord;
export declare function hexScale(hex: HexCoord, scalar: number): HexCoord;
export declare function hexDirection(direction: number): HexCoord;
export declare function hexNeighbor(hex: HexCoord, direction: number): HexCoord;
export declare function hexNeighbors(hex: HexCoord): HexCoord[];
export declare function hexDistance(a: HexCoord, b: HexCoord): number;
export declare function hexLength(hex: HexCoord): number;
export declare function hexRing(center: HexCoord, radius: number): HexCoord[];
export declare function hexRange(center: HexCoord, radius: number): HexCoord[];
export declare function hexLine(a: HexCoord, b: HexCoord): HexCoord[];
export declare function hexLerp(a: HexCoord, b: HexCoord, t: number): {
    q: number;
    r: number;
};
export declare function hexRound(coord: {
    q: number;
    r: number;
}): HexCoord;
export declare function isValidHex(hex: HexCoord, mapSize?: number): boolean;
export declare function axialToOffset(hex: HexCoord): {
    col: number;
    row: number;
};
export declare function offsetToAxial(col: number, row: number): HexCoord;
export declare function pixelToHex(x: number, y: number, size: number): HexCoord;
export declare function hexToPixel(hex: HexCoord, size: number): {
    x: number;
    y: number;
};
export declare function getHexCorners(centerX: number, centerY: number, size: number): {
    x: number;
    y: number;
}[];
