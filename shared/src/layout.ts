export type Point = { x: number; y: number };
export type Direction = 'N' | 'E' | 'S' | 'W';
export type CellKind = 'floor' | 'shelf' | 'parking' | 'station' | 'dock';

export interface Layout {
  width: number;
  height: number;
  cells: CellKind[][];
  exits: Record<string, Direction[]>;
  shelfAccess: Point[];
  parking: Point[];
  stations: Point[];
  dock: Point;
}

const key = ({ x, y }: Point) => `${x},${y}`;
const shelfXs = [5, 8, 11, 14, 17, 20, 23, 26];
const shelfRows = [...Array(6).keys()].flatMap((y) => [y + 2, y + 11]);

export const pointKey = key;
export const equalPoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

export function buildLayout(): Layout {
  const width = 32;
  const height = 20;
  const cells = Array.from({ length: height }, () => Array<CellKind>(width).fill('floor'));
  const shelves = new Set<string>();
  const shelfAccess: Point[] = [];
  for (const x of shelfXs) for (const y of shelfRows) {
    for (const shelfX of [x, x + 1]) { cells[y][shelfX] = 'shelf'; shelves.add(`${shelfX},${y}`); }
    shelfAccess.push({ x: x - 1, y }, { x: x + 2, y });
  }
  const parking = Array.from({ length: width }, (_, x) => ({ x, y: 19 }));
  parking.forEach(({ x, y }) => { cells[y][x] = 'parking'; });
  const stations = [{ x: 1, y: 8 }, { x: 1, y: 9 }, { x: 1, y: 10 }];
  stations.forEach(({ x, y }) => { cells[y][x] = 'station'; });
  const dock = { x: 30, y: 9 };
  cells[dock.y][dock.x] = 'dock';
  const exits: Record<string, Direction[]> = {};
  const add = (point: Point, direction: Direction) => {
    const id = key(point);
    exits[id] ??= [];
    if (!exits[id].includes(direction)) exits[id].push(direction);
  };
  for (let y = 0; y < 19; y++) for (let x = 0; x < width; x++) {
    if (shelves.has(`${x},${y}`)) continue;
    if (x <= 3 || x >= 29) for (const d of ['N', 'E', 'S', 'W'] as Direction[]) add({ x, y }, d);
    if ([4, 10, 16, 22, 28].includes(x)) add({ x, y }, 'S');
    if ([7, 13, 19, 25].includes(x)) add({ x, y }, 'N');
    if ([1, 8, 9, 17].includes(y) && x >= 4 && x <= 28) add({ x, y }, 'E');
    if ([0, 10, 18].includes(y) && x >= 4 && x <= 28) add({ x, y }, 'W');
    if (y === 18) add({ x, y }, 'S');
  }
  parking.forEach((point) => add(point, 'N'));
  return { width, height, cells, exits, shelfAccess, parking, stations, dock };
}

export function neighbours(layout: Layout, point: Point): Point[] {
  const delta: Record<Direction, Point> = { N: { x: 0, y: -1 }, E: { x: 1, y: 0 }, S: { x: 0, y: 1 }, W: { x: -1, y: 0 } };
  return (layout.exits[key(point)] ?? []).map((d) => ({ x: point.x + delta[d].x, y: point.y + delta[d].y }))
    .filter(({ x, y }) => x >= 0 && y >= 0 && x < layout.width && y < layout.height && layout.cells[y][x] !== 'shelf');
}
