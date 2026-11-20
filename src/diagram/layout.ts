import type { LayoutAlgorithm } from './model';

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
  /** Cómo se reparte cada capa en el eje transversal (por defecto `balanced`) */
  algorithm?: LayoutAlgorithm;
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
  /** Hojas de un mismo padre a partir de las cuales se reparten en rejilla si alargan su columna */
  const LEAF_GRID_MIN = 4;
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
  const members = new Map<string, string[]>();
  for (const b of boxes) if (b.group) (members.get(b.group) ?? members.set(b.group, []).get(b.group)!).push(b.id);
  const hasEdges = stacked.length > 0 || [...out.values()].some((a) => a.length);
  /**
   * Hijos anidados que se colocan junto a su padre. Si el hijo es de un grupo distinto del de su
   * padre, manda el grupo: va con los demás miembros y la conexión no cuenta para las capas.
   */
  const besideParent = stacked.filter((e) => !groupOf(e.target) || groupOf(e.target) === groupOf(e.source));

  // Sin aristas ni grupos: rejilla
  if (!hasEdges && !members.size) {
    const cols = Math.ceil(Math.sqrt(boxes.length));
    const cw = Math.max(...boxes.map((b) => b.w)) + gapCross;
    const ch = Math.max(...boxes.map((b) => b.h)) + gapCross;
    boxes.forEach((b, i) => {
      b.x = (i % cols) * cw;
      b.y = Math.floor(i / cols) * ch;
    });
    return;
  }

  // Las capas se calculan sobre un grafo contraído: los miembros de un grupo, y un padre con sus
  // hijos anidados, son un solo nodo y comparten capa (así el grupo cabe en una sola caja). Las
  // aristas entre ellos no cuentan para las capas.
  const repOf = new Map(ids.map((i) => [i, i]));
  const find = (x: string): string => {
    while (repOf.get(x) !== x) {
      repOf.set(x, repOf.get(repOf.get(x)!)!);
      x = repOf.get(x)!;
    }
    return x;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) repOf.set(rb, ra);
  };
  for (const ms of members.values()) for (const m of ms.slice(1)) union(ms[0], m);
  for (const e of besideParent) union(e.source, e.target);
  const reps = [...new Set(ids.map(find))];
  const rOut = new Map(reps.map((r) => [r, new Set<string>()]));
  const rInc = new Map(reps.map((r) => [r, new Set<string>()]));
  for (const [u, vs] of out) {
    for (const v of vs) {
      const ru = find(u);
      const rv = find(v);
      if (ru === rv) continue;
      rOut.get(ru)!.add(rv);
      rInc.get(rv)!.add(ru);
    }
  }

  // Romper ciclos (DFS: las aristas hacia atrás no cuentan para las capas)
  const SEP = '\u0001';
  const mark = new Map<string, number>();
  const back = new Set<string>();
  const dfs = (u: string) => {
    mark.set(u, 1);
    for (const v of rOut.get(u)!) {
      if (mark.get(v) === 1) back.add(u + SEP + v);
      else if (!mark.has(v)) dfs(v);
    }
    mark.set(u, 2);
  };
  reps.filter((r) => !rInc.get(r)!.size).forEach((r) => mark.has(r) || dfs(r));
  reps.forEach((r) => mark.has(r) || dfs(r));
  const fwd = (u: string, v: string) => !back.has(u + SEP + v);

  // Capas por camino más largo (Kahn)
  const repRank = new Map(reps.map((r) => [r, 0]));
  const indeg = new Map(reps.map((r) => [r, [...rInc.get(r)!].filter((u) => fwd(u, r)).length]));
  const queue = reps.filter((r) => !indeg.get(r));
  const topo: string[] = [];
  while (queue.length) {
    const u = queue.shift()!;
    topo.push(u);
    for (const v of rOut.get(u)!) {
      if (!fwd(u, v)) continue;
      repRank.set(v, Math.max(repRank.get(v)!, repRank.get(u)! + 1));
      indeg.set(v, indeg.get(v)! - 1);
      if (!indeg.get(v)) queue.push(v);
    }
  }
  // Acercar cada fuente a su primer sucesor
  for (const u of [...topo].reverse()) {
    if ([...rInc.get(u)!].some((p) => fwd(p, u))) continue;
    const succ = [...rOut.get(u)!].filter((v) => fwd(u, v));
    if (succ.length) repRank.set(u, Math.min(...succ.map((v) => repRank.get(v)!)) - 1);
  }
  // Sin aristas: cada grupo en su columna y los nodos sueltos en la última
  if (!hasEdges) {
    const groupReps = [...new Set([...members.values()].map((ms) => find(ms[0])))];
    for (const r of reps) repRank.set(r, groupReps.includes(r) ? groupReps.indexOf(r) : groupReps.length);
  }
  const rank = new Map(ids.map((i) => [i, repRank.get(find(i))!]));
  const minRank = Math.min(...rank.values());
  const layers: string[][] = [];
  ids.forEach((i) => (layers[rank.get(i)! - minRank] ??= []).push(i));
  for (let r = 0; r < layers.length; r++) layers[r] ??= [];

  const algorithm = opts.algorithm ?? 'balanced';
  /**
   * Hojas de un mismo padre (sin salidas, sin grupo y con ese único predecesor) que, apiladas en su
   * columna, la alargarían respecto a sus vecinas: se reparten en rejilla, en varias subcolumnas,
   * para que ocupen menos alto. Se tratan como un grupo «box» que no pinta caja.
   */
  const leafCluster = new Map<string, string>();
  if (algorithm !== 'barycenter') {
    const nestedIds = new Set(stacked.flatMap((e) => [e.source, e.target]));
    const byParent = new Map<string, string[]>();
    for (const id of ids) {
      const preds = inc.get(id)!;
      if (out.get(id)!.length || groupOf(id) || nestedIds.has(id) || new Set(preds).size !== 1) continue;
      (byParent.get(preds[0]) ?? byParent.set(preds[0], []).get(preds[0])!).push(id);
    }
    for (const [p, leaves] of byParent) {
      // Sólo hay desnivel si en la columna hay más nodos que esas hojas
      if (leaves.length >= LEAF_GRID_MIN && layers[rank.get(leaves[0])! - minRank].length > leaves.length) {
        for (const id of leaves) leafCluster.set(id, `leaves:${p}`);
      }
    }
  }
  /** Conjunto de nodos que van seguidos en su capa: su grupo o su rejilla de hojas */
  const clusterOf = (id: string) => groupOf(id) ?? leafCluster.get(id);
  const clusters = new Map(members);
  for (const [id, c] of leafCluster) (clusters.get(c) ?? clusters.set(c, []).get(c)!).push(id);

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
    for (const [g, ms] of clusters) {
      const here = ms.filter((id) => idx.has(id));
      if (here.length) avg.set(g, here.reduce((a, id) => a + idx.get(id)!, 0) / here.length);
    }
    const key = (id: string) => (clusterOf(id) ? avg.get(clusterOf(id)!)! : idx.get(id)!);
    L.sort((a, b) => key(a) - key(b) || (clusterOf(a) ?? '').localeCompare(clusterOf(b) ?? '') || idx.get(a)! - idx.get(b)!);
  }

  // Cada hijo anidado justo detrás de su padre en el orden de la capa; si el padre es de un grupo
  // y el hijo no, detrás del último miembro del grupo (para no partir la caja)
  for (const e of besideParent) {
    const L = layers[rank.get(e.source)! - minRank];
    L.splice(L.indexOf(e.target), 1);
    const g = groupOf(e.source);
    let at = L.indexOf(e.source);
    if (g && groupOf(e.target) !== g) while (at + 1 < L.length && groupOf(L[at + 1]) === g) at++;
    L.splice(at + 1, 0, e.target);
  }

  // Coordenadas. Cada capa se reparte en "bloques": un nodo suelto, o un tramo seguido de un
  // grupo con layout "box", cuyos miembros van en rejilla dentro del bloque. El eje principal
  // (columnas en LR) sale de las capas; el transversal lo decide el algoritmo elegido.
  type Block = {
    ids: string[];
    cols: number;
    cell: { main: number; cross: number };
    main: number;
    cross: number;
    layer: number;
    /** Separación mínima con el bloque anterior de la capa */
    gap: number;
    /** Posición transversal (borde superior en LR, izquierdo en TB) */
    top: number;
  };
  const boxGroups = opts.boxGroups ?? new Set<string>();
  const blockOf = new Map<string, Block>();
  const layerBlocks: Block[][] = layers.map((L, layer) => {
    const blocks: Block[] = [];
    for (const id of L) {
      const g = clusterOf(id);
      const last = blocks[blocks.length - 1];
      if (g && (boxGroups.has(g) || leafCluster.has(id)) && last && clusterOf(last.ids[0]) === g) last.ids.push(id);
      else blocks.push({ ids: [id], cols: 1, cell: { main: 0, cross: 0 }, main: 0, cross: 0, layer, gap: gapCross, top: 0 });
    }
    blocks.forEach((bl, k) => {
      const bs = bl.ids.map((id) => byId.get(id)!);
      bl.cols = Math.ceil(Math.sqrt(bs.length));
      const rows = Math.ceil(bs.length / bl.cols);
      bl.cell = { main: Math.max(...bs.map(main)), cross: Math.max(...bs.map(cross)) };
      bl.main = bl.cols * bl.cell.main + (bl.cols - 1) * BOX_GAP;
      bl.cross = rows * bl.cell.cross + (rows - 1) * BOX_GAP;
      bl.ids.forEach((id) => blockOf.set(id, bl));
      if (k > 0) {
        const prev = blocks[k - 1].ids[blocks[k - 1].ids.length - 1];
        const first = bl.ids[0];
        // Hijo anidado justo detrás de su padre: hueco extra para la flecha y su etiqueta
        if (nestedPairs.has(prev + SEP + first)) bl.gap = gapCross + NESTED_GAP;
        // Cambio de grupo: hueco para el borde y el título de las cajas
        if ((groupOf(prev) || groupOf(first)) && groupOf(prev) !== groupOf(first)) bl.gap = Math.max(bl.gap, GROUP_GAP);
      }
    });
    return blocks;
  });
  /** Centro transversal de un nodo, respecto al borde de su bloque */
  const offsetIn = (id: string) => {
    const bl = blockOf.get(id)!;
    const row = Math.floor(bl.ids.indexOf(id) / bl.cols);
    return row * (bl.cell.cross + BOX_GAP) + bl.cell.cross / 2;
  };
  const centerOf = (id: string) => blockOf.get(id)!.top + offsetIn(id);
  const neighbors = (bl: Block) => bl.ids.flatMap((id) => inc.get(id)!.concat(out.get(id)!));
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  // Alineado con la media de los vecinos ya colocados (capas anteriores), de izquierda a derecha
  const placed = new Set<Block>();
  for (const blocks of layerBlocks) {
    if (!blocks.length) continue;
    const want = blocks.map((bl) => mean(neighbors(bl).filter((x) => placed.has(blockOf.get(x)!)).map(centerOf)));
    greedyPack(blocks, want);
    blocks.forEach((bl) => placed.add(bl));
  }
  if (algorithm === 'balanced') balance();
  if (algorithm === 'subtree') subtree();

  /**
   * Relajación: barridos alternos (de derecha a izquierda y vuelta) en los que cada bloque busca la
   * media de todos sus vecinos de otras capas (padres e hijos). Un padre con muchos hijos se
   * centra en ellos y sus vecinos de capa se apartan, en vez de quedar todos apiñados.
   */
  function balance() {
    for (let it = 0; it < 12; it++) {
      const order = it % 2 === 0 ? [...layerBlocks].reverse() : layerBlocks;
      for (const blocks of order) {
        if (!blocks.length) continue;
        const want = blocks.map((bl) => mean(neighbors(bl).filter((x) => blockOf.get(x)!.layer !== bl.layer).map(centerOf)));
        isoPack(blocks, want);
      }
    }
  }

  /**
   * Por subárboles: cada bloque «adopta» a los bloques de la capa siguiente cuyo padre (el
   * predecesor mediano en la capa anterior) es él, y reserva tanto espacio como necesitan sus
   * descendientes. Después se coloca de izquierda a derecha: cada padre centrado en su reserva y
   * sus hijos repartidos dentro de ella.
   */
  function subtree() {
    const parent = new Map<Block, Block>();
    const children = new Map<Block, Block[]>();
    layerBlocks.forEach((blocks, r) => {
      if (!r) return;
      const prevIdx = new Map(layerBlocks[r - 1].map((b, k) => [b, k]));
      for (const bl of blocks) {
        const preds = [...new Set(bl.ids.flatMap((id) => inc.get(id)!).map((x) => blockOf.get(x)!))].filter((p) => prevIdx.has(p));
        if (!preds.length) continue;
        preds.sort((a, b) => prevIdx.get(a)! - prevIdx.get(b)!);
        const p = preds[(preds.length - 1) >> 1];
        parent.set(bl, p);
        (children.get(p) ?? children.set(p, []).get(p)!).push(bl);
      }
    });
    const span = new Map<Block, number>();
    const childSpan = (bl: Block) => {
      const cs = children.get(bl) ?? [];
      return cs.reduce((a, c, k) => a + span.get(c)! + (k ? c.gap : 0), 0);
    };
    for (let r = layerBlocks.length - 1; r >= 0; r--) for (const bl of layerBlocks[r]) span.set(bl, Math.max(bl.cross, childSpan(bl)));

    layerBlocks.forEach((blocks, r) => {
      if (!blocks.length) return;
      const want: (number | null)[] = blocks.map(() => null);
      const idx = new Map(blocks.map((b, k) => [b, k]));
      // Raíces (sin padre en la capa anterior): seguidas, cada una centrada en su reserva
      let cursor = 0;
      blocks.forEach((bl, k) => {
        if (parent.has(bl)) return;
        const nb = mean(neighbors(bl).filter((x) => blockOf.get(x)!.layer < r).map(centerOf));
        if (nb != null) want[k] = nb;
        else {
          want[k] = cursor + span.get(bl)! / 2;
          cursor += span.get(bl)! + bl.gap;
        }
      });
      // Hijos: repartidos en la reserva del padre, centrada en él
      for (const p of r ? layerBlocks[r - 1] : []) {
        const cs = children.get(p);
        if (!cs) continue;
        let at = p.top + p.cross / 2 - childSpan(p) / 2;
        cs.forEach((c, k) => {
          if (k) at += c.gap;
          want[idx.get(c)!] = at + span.get(c)! / 2;
          at += span.get(c)!;
        });
      }
      isoPack(blocks, want);
    });
  }

  /**
   * Coloca una capa de arriba abajo empujando lo que se solape, y después la desplaza entera para
   * que, de media, los bloques queden donde querían (`want`: centro deseado, o null).
   */
  function greedyPack(blocks: Block[], want: (number | null)[]) {
    let cur = -Infinity;
    const tops = blocks.map((bl, k) => {
      let top = want[k] != null ? want[k]! - bl.cross / 2 : cur;
      if (k > 0) top = Math.max(top, cur + bl.gap);
      if (!Number.isFinite(top)) top = 0;
      cur = top + bl.cross;
      return top;
    });
    const diffs = blocks.flatMap((bl, k) => (want[k] != null ? [want[k]! - (tops[k] + bl.cross / 2)] : []));
    const shift = diffs.length ? mean(diffs)! : -tops[0] - (cur - tops[0]) / 2;
    blocks.forEach((bl, k) => (bl.top = tops[k] + shift));
  }

  /**
   * Reparto óptimo de una capa: la posición más cercana (mínimos cuadrados) a la deseada de cada
   * bloque sin solaparse ni cambiar el orden (regresión isotónica, «pool adjacent violators»).
   * Los bloques sin deseo siguen al anterior.
   */
  function isoPack(blocks: Block[], want: (number | null)[]) {
    // Con u_k = top_k - O_k (O_k: alto acumulado de los anteriores y sus huecos), la restricción
    // «no solaparse» es u no decreciente
    const O: number[] = [];
    blocks.forEach((bl, k) => O.push(k ? O[k - 1] + blocks[k - 1].cross + bl.gap : 0));
    const desired = blocks.map((bl, k) => (want[k] != null ? want[k]! - bl.cross / 2 - O[k] : null));
    // Sin deseo: el del vecino más cercano con él, con un peso mínimo
    const known = desired.map((d, k) => (d != null ? k : -1)).filter((k) => k >= 0);
    if (!known.length) return;
    const x = desired.map((d, k) => d ?? desired[known.reduce((a, j) => (Math.abs(j - k) < Math.abs(a - k) ? j : a))]!);
    const w = desired.map((d) => (d != null ? 1 : 1e-3));
    const pools: { sum: number; weight: number; n: number }[] = [];
    x.forEach((v, k) => {
      pools.push({ sum: v * w[k], weight: w[k], n: 1 });
      while (pools.length > 1) {
        const a = pools[pools.length - 2];
        const b = pools[pools.length - 1];
        if (a.sum / a.weight <= b.sum / b.weight) break;
        pools.splice(-2, 2, { sum: a.sum + b.sum, weight: a.weight + b.weight, n: a.n + b.n });
      }
    });
    let k = 0;
    for (const p of pools) for (let i = 0; i < p.n; i++, k++) blocks[k].top = p.sum / p.weight + O[k];
  }

  let offset = 0;
  for (const [layerIndex, blocks] of layerBlocks.entries()) {
    if (!blocks.length) continue;
    const thick = Math.max(...blocks.map((bl) => bl.main));
    // Con una rejilla de hojas, todo pegado al lado de los padres (si no, centrado en la columna)
    const atStart = blocks.some((bl) => leafCluster.has(bl.ids[0]));
    let slot = 0;
    for (const bl of blocks) {
      const m0 = offset + (atStart ? 0 : (thick - bl.main) / 2);
      bl.ids.forEach((id, j) => {
        const b = byId.get(id)!;
        const col = j % bl.cols;
        const row = Math.floor(j / bl.cols);
        const m = m0 + col * (bl.cell.main + BOX_GAP) + (bl.cell.main - main(b)) / 2;
        const c = bl.top + row * (bl.cell.cross + BOX_GAP) + (bl.cell.cross - cross(b)) / 2;
        if (LR) {
          b.x = m;
          b.y = c;
        } else {
          b.x = c;
          b.y = m;
        }
        b.layer = layerIndex;
        b.slot = slot++;
      });
    }
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
