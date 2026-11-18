/**
 * Autolayout por capas (estilo dagre simplificado) para los nodos que no traen
 * posición: rompe ciclos, asigna capas por camino más largo, reduce cruces con
 * baricentros y alinea cada nodo con sus vecinos ya colocados.
 */
/**
 * `group`: dentro de cada capa, los nodos del mismo grupo van seguidos para poder envolverlos en una caja.
 * Salida: `layer` (capa asignada) y `slot` (posición dentro de la capa) para saber qué nodos comparten caja.
 */
export type LayoutBox = { id: string; w: number; h: number; x: number; y: number; group?: string; layer?: number; slot?: number };
/**
 * `nested`: conexión padre→hijo, que sale perpendicular a la dirección del flujo.
 * El hijo se coloca en la misma capa que el padre, justo a continuación (debajo en LR, a la derecha en TB).
 */
export type LayoutEdge = { source: string; target: string; nested?: boolean };
export type LayoutOptions = {
  direction: 'LR' | 'TB';
  rankGap?: number;
  nodeGap?: number;
  /** Grupos cuyos nodos se reparten en rejilla (layout "box") */
  boxGroups?: Set<string>;
};

export function autoLayout(boxes: LayoutBox[], edges: LayoutEdge[], opts: LayoutOptions): void {
  if (!boxes.length) return;
  const LR = opts.direction !== 'TB';
  const gapMain = opts.rankGap ?? (LR ? 110 : 80);
  const gapCross = opts.nodeGap ?? (LR ? 40 : 50);
  const ids = boxes.map((b) => b.id);
  const set = new Set(ids);
  const byId = new Map(boxes.map((b) => [b.id, b]));
  const out = new Map(ids.map((i) => [i, [] as string[]]));
  const inc = new Map(ids.map((i) => [i, [] as string[]]));
  const stacked = edges.filter((e) => e.nested && set.has(e.source) && set.has(e.target) && e.source !== e.target);
  const nestedPairs = new Set(stacked.map((e) => e.source + '\u0001' + e.target));
  /** Separación adicional entre un padre y su hijo anidado */
  const NESTED_GAP = 36;
  /** Separación mínima entre nodos de grupos distintos (deja sitio al borde y al título de la caja) */
  const GROUP_GAP = 64;
  /** Separación entre celdas de la rejilla de un grupo "box" */
  const BOX_GAP = 28;
  const groupOf = (id: string) => byId.get(id)!.group;
  for (const e of edges) {
    if (e.nested) continue;
    if (set.has(e.source) && set.has(e.target) && e.source !== e.target) {
      out.get(e.source)!.push(e.target);
      inc.get(e.target)!.push(e.source);
    }
  }
  const main = (b: LayoutBox) => (LR ? b.w : b.h);
  const cross = (b: LayoutBox) => (LR ? b.h : b.w);

  // Sin aristas: rejilla
  if (!stacked.length && ![...out.values()].some((a) => a.length)) {
    const cols = Math.ceil(Math.sqrt(boxes.length));
    const cw = Math.max(...boxes.map((b) => b.w)) + gapCross;
    const ch = Math.max(...boxes.map((b) => b.h)) + gapCross;
    boxes.forEach((b, i) => {
      b.x = (i % cols) * cw;
      b.y = Math.floor(i / cols) * ch;
    });
    return;
  }

  // Romper ciclos (DFS: las aristas hacia atrás no cuentan para las capas)
  const SEP = '\u0001';
  const mark = new Map<string, number>();
  const back = new Set<string>();
  const dfs = (u: string) => {
    mark.set(u, 1);
    for (const v of out.get(u)!) {
      if (mark.get(v) === 1) back.add(u + SEP + v);
      else if (!mark.has(v)) dfs(v);
    }
    mark.set(u, 2);
  };
  ids.filter((i) => !inc.get(i)!.length).forEach((i) => mark.has(i) || dfs(i));
  ids.forEach((i) => mark.has(i) || dfs(i));
  const fwd = (u: string, v: string) => !back.has(u + SEP + v);

  // Capas por camino más largo (Kahn)
  const rank = new Map(ids.map((i) => [i, 0]));
  const indeg = new Map(ids.map((i) => [i, inc.get(i)!.filter((u) => fwd(u, i)).length]));
  const queue = ids.filter((i) => !indeg.get(i));
  const topo: string[] = [];
  while (queue.length) {
    const u = queue.shift()!;
    topo.push(u);
    for (const v of out.get(u)!) {
      if (!fwd(u, v)) continue;
      rank.set(v, Math.max(rank.get(v)!, rank.get(u)! + 1));
      indeg.set(v, indeg.get(v)! - 1);
      if (!indeg.get(v)) queue.push(v);
    }
  }
  // Acercar cada fuente a su primer sucesor
  for (const u of [...topo].reverse()) {
    if (inc.get(u)!.some((p) => fwd(p, u))) continue;
    const succ = out.get(u)!.filter((v) => fwd(u, v));
    if (succ.length) rank.set(u, Math.min(...succ.map((v) => rank.get(v)!)) - 1);
  }
  // Hijos anidados: misma capa que su padre
  for (let i = 0; i < stacked.length; i++) for (const e of stacked) rank.set(e.target, rank.get(e.source)!);
  // Los grupos no cambian la capa: las flechas (dependencias a la derecha, usos debajo) tienen preferencia
  const members = new Map<string, string[]>();
  for (const b of boxes) if (b.group) (members.get(b.group) ?? members.set(b.group, []).get(b.group)!).push(b.id);
  const minRank = Math.min(...rank.values());
  const layers: string[][] = [];
  ids.forEach((i) => (layers[rank.get(i)! - minRank] ??= []).push(i));
  for (let r = 0; r < layers.length; r++) layers[r] ??= [];

  // Reducción de cruces por baricentro (barridos alternos)
  const pos = new Map<string, number>();
  layers.forEach((L) => L.forEach((id, k) => pos.set(id, k)));
  for (let it = 0; it < 8; it++) {
    const down = it % 2 === 0;
    const order = layers.map((_, r) => r);
    if (!down) order.reverse();
    for (const r of order.slice(1)) {
      const L = layers[r];
      const ref = (down ? r - 1 : r + 1) + minRank;
      const val = new Map(
        L.map((id) => {
          const nb = (down ? inc.get(id)! : out.get(id)!).filter((x) => rank.get(x) === ref);
          return [id, nb.length ? nb.reduce((a, x) => a + pos.get(x)!, 0) / nb.length : pos.get(id)!];
        }),
      );
      L.sort((a, b) => val.get(a)! - val.get(b)!);
      L.forEach((id, k) => pos.set(id, k));
    }
  }

  // Miembros de un mismo grupo seguidos, en la posición media del grupo
  for (const L of layers) {
    const idx = new Map(L.map((id, k) => [id, k]));
    const avg = new Map<string, number>();
    for (const [g, ms] of members) {
      const here = ms.filter((id) => idx.has(id));
      if (here.length) avg.set(g, here.reduce((a, id) => a + idx.get(id)!, 0) / here.length);
    }
    const key = (id: string) => (groupOf(id) ? avg.get(groupOf(id)!)! : idx.get(id)!);
    L.sort((a, b) => key(a) - key(b) || (groupOf(a) ?? '').localeCompare(groupOf(b) ?? '') || idx.get(a)! - idx.get(b)!);
  }

  // Cada hijo anidado justo detrás de su padre en el orden de la capa
  for (const e of stacked) {
    const L = layers[rank.get(e.source)! - minRank];
    L.splice(L.indexOf(e.target), 1);
    L.splice(L.indexOf(e.source) + 1, 0, e.target);
  }

  // Coordenadas. Cada capa se reparte en "bloques": un nodo suelto, o un tramo seguido de un
  // grupo con layout "box", cuyos miembros van en rejilla dentro del bloque. Cada bloque se
  // alinea con la media de sus vecinos ya colocados.
  type Block = { ids: string[]; cols: number; cell: { main: number; cross: number }; main: number; cross: number };
  const boxGroups = opts.boxGroups ?? new Set<string>();
  let offset = 0;
  const center = new Map<string, number>();
  for (const [layerIndex, L] of layers.entries()) {
    if (!L.length) continue;
    const blocks: Block[] = [];
    for (const id of L) {
      const g = groupOf(id);
      const last = blocks[blocks.length - 1];
      if (g && boxGroups.has(g) && last && groupOf(last.ids[0]) === g) last.ids.push(id);
      else blocks.push({ ids: [id], cols: 1, cell: { main: 0, cross: 0 }, main: 0, cross: 0 });
    }
    for (const bl of blocks) {
      const bs = bl.ids.map((id) => byId.get(id)!);
      bl.cols = Math.ceil(Math.sqrt(bs.length));
      const rows = Math.ceil(bs.length / bl.cols);
      bl.cell = { main: Math.max(...bs.map(main)), cross: Math.max(...bs.map(cross)) };
      bl.main = bl.cols * bl.cell.main + (bl.cols - 1) * BOX_GAP;
      bl.cross = rows * bl.cell.cross + (rows - 1) * BOX_GAP;
    }
    const thick = Math.max(...blocks.map((bl) => bl.main));
    const want = blocks.map((bl) => {
      const nb = bl.ids.flatMap((id) => inc.get(id)!.concat(out.get(id)!)).filter((x) => center.has(x));
      return nb.length ? nb.reduce((a, x) => a + center.get(x)!, 0) / nb.length : null;
    });
    let cur = -Infinity;
    const placed = blocks.map((bl, k) => {
      const s = bl.cross;
      let top = want[k] != null ? want[k]! - s / 2 : cur;
      if (top < cur) top = cur;
      if (k > 0) {
        const prev = blocks[k - 1].ids[blocks[k - 1].ids.length - 1];
        const first = bl.ids[0];
        // Hijo anidado justo detrás de su padre: hueco extra para la flecha y su etiqueta
        if (nestedPairs.has(prev + SEP + first)) top = Math.max(top, cur + NESTED_GAP);
        // Cambio de grupo: hueco para el borde y el título de las cajas
        if ((groupOf(prev) || groupOf(first)) && groupOf(prev) !== groupOf(first)) top = Math.max(top, cur - gapCross + GROUP_GAP);
      }
      if (!Number.isFinite(top)) top = 0;
      cur = top + s + gapCross;
      return top;
    });
    const diffs = blocks.flatMap((bl, k) => (want[k] != null ? [want[k]! - (placed[k] + bl.cross / 2)] : []));
    const total = cur - gapCross - placed[0];
    const shift = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : -placed[0] - total / 2;
    let slot = 0;
    blocks.forEach((bl, k) => {
      const c0 = placed[k] + shift;
      const m0 = offset + (thick - bl.main) / 2;
      bl.ids.forEach((id, j) => {
        const b = byId.get(id)!;
        const col = j % bl.cols;
        const row = Math.floor(j / bl.cols);
        const m = m0 + col * (bl.cell.main + BOX_GAP) + (bl.cell.main - main(b)) / 2;
        const c = c0 + row * (bl.cell.cross + BOX_GAP) + (bl.cell.cross - cross(b)) / 2;
        if (LR) {
          b.x = m;
          b.y = c;
        } else {
          b.x = c;
          b.y = m;
        }
        center.set(id, c + cross(b) / 2);
        b.layer = layerIndex;
        b.slot = slot++;
      });
    });
    offset += thick + gapMain;
  }
}

/** Coloca `free` a la derecha de los nodos con posición fija para que no se solapen. */
export function placeBeside(fixed: LayoutBox[], free: LayoutBox[], gap = 140) {
  if (!fixed.length || !free.length) return;
  const fx2 = Math.max(...fixed.map((b) => b.x + b.w));
  const fy = Math.min(...fixed.map((b) => b.y));
  const lx = Math.min(...free.map((b) => b.x));
  const ly = Math.min(...free.map((b) => b.y));
  for (const b of free) {
    b.x += fx2 + gap - lx;
    b.y += fy - ly;
  }
}
