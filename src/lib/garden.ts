/** Layout for the initiator's garden, kept pure so it can be tested. */

/** A stable number from a string, so each person keeps the same aster, tile and pose. */
export function seed(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** The smallest square plot that holds everyone, never smaller than 4 × 4. */
export function plotSize(count: number) {
  return Math.max(4, Math.ceil(Math.sqrt(count)));
}

/** Tiles in planting order for a plot: scattered, but the same every time. */
export function plantingOrder(size: number): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let row = 0; row < size; row += 1) for (let col = 0; col < size; col += 1) cells.push([row, col]);
  return cells.sort((a, b) => seed(`${size}:${a[0]}:${a[1]}`) - seed(`${size}:${b[0]}:${b[1]}`));
}
