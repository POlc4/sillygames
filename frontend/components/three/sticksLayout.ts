// Disposition et sélection des bâtonnets en 3D. Fonctions pures, testées sans WebGL.

export const PER_ROW = 5;
export const STICK_SPACING = 0.35;
export const ROW_SPACING = 0.6;

export type Vec3 = [number, number, number];

/** Position de chaque bâtonnet : rangées de PER_ROW, centrées sur l'origine. */
export function stickPositions(count: number): Vec3[] {
  const rows = Math.max(1, Math.ceil(count / PER_ROW));
  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / PER_ROW);
    const col = i % PER_ROW;
    const x = (col - (PER_ROW - 1) / 2) * STICK_SPACING;
    const z = (row - (rows - 1) / 2) * ROW_SPACING;
    return [x, 0, z];
  });
}

/**
 * Survoler le bâtonnet d'index `hovered` propose de retirer tous ceux qui le suivent.
 * Renvoie le nombre à retirer, ou 0 si ce retrait n'est pas légal.
 */
export function takeCountForHover(hovered: number, shown: number, legalMoves: number[]): number {
  const count = shown - hovered;
  return legalMoves.includes(count) ? count : 0;
}

/** Indices mis en surbrillance pour un retrait de `count` bâtonnets parmi `shown`. */
export function highlightedIndices(count: number, shown: number): number[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, i) => shown - count + i);
}
