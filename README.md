# Visor de diagramas

Visor de solo lectura para diagramas en JSON, construido con React y React Flow. Al compilarlo se genera un único `diagram-viewer.html` autocontenido: se copia en la carpeta de diagramas y se abre con el navegador.

## Uso

Requiere Node ≥ 20.19 y pnpm 10.

```bash
pnpm install
pnpm run dev        # http://localhost:5737 — sirve example/ como si fuera la carpeta de diagramas
pnpm run build      # comprueba tipos y genera dist/diagram-viewer.html (un único fichero)
pnpm run typecheck  # sólo comprobación de tipos
pnpm run preview    # http://localhost:5738 — sirve dist/ (sin diagramas al lado: muestra la pantalla de acceso a carpeta)
```

En desarrollo, el contenido de [example/](example/) se sirve en la raíz (`/index.json`, `/public/e-commerce/…`), así que el visor lo lee por HTTP sin pedir permisos y se recarga en caliente al cambiar el código.

Copia `dist/diagram-viewer.html` en la raíz de la carpeta de diagramas y ábrelo:

- **Como fichero (`file://`)**: el visor pide acceso a la carpeta.
  - En Chrome y Edge la recuerda, y en la siguiente visita basta un clic.
  - En Firefox y Safari usa el selector de carpeta, o se puede arrastrar la carpeta a la ventana.
- **Por HTTP** (`python3 -m http.server`): lee los ficheros directamente, sin pedir permiso.

Al abrirlo se muestra el árbol de diagramas de la carpeta. Al elegir uno se abre su diagrama raíz. Desde ahí:

- Pulsar un nodo `diagram` abre ese diagrama.
- Pulsar cualquier otro nodo, o una arista, abre su ficha.
- Retroceso vuelve al diagrama padre (o al árbol) y Esc cierra la ficha.

### Estado en la URL

Todo lo que se ve queda en el hash de la URL, así que al recargar, volver atrás o compartir el enlace se recupera la misma vista:

```
#file=public/e-commerce&d=pedidos/index.json&sel=svc&vp=431,343,0.67
```

| Parámetro | Qué guarda |
|---|---|
| `file` | Diagrama elegido en el árbol: una carpeta con `index.json` o un fichero `.json`. Va siempre primero; sin él se muestra el árbol. |
| `d` | Subdiagramas abiertos, en orden y uno por parámetro, relativos a la carpeta del diagrama raíz. Los definidos dentro de otro diagrama van como `fichero::idDelNodo` (p. ej. `index.json::backend`). |
| `sel` | Nodo o arista con la ficha abierta. |
| `vp` | Desplazamiento `x,y` y zoom del lienzo. |

Cambiar de diagrama crea una entrada en el historial del navegador. Seleccionar, desplazar o hacer zoom la actualiza sin crear entradas nuevas.

## Formato

La carpeta contiene `index.json` (el índice de diagramas) y una carpeta por diagrama, cada una con su diagrama raíz, sus subdiagramas y, opcionalmente, su `catalog.json`:

```
example/
├── index.json              índice: nombres y rutas de los diagramas
└── public/
    ├── e-commerce/
    │   ├── index.json      diagrama raíz de «e-commerce»
    │   ├── catalog.json    catálogo de «e-commerce»
    │   └── pedidos/…       subdiagramas (usan el catálogo de e-commerce)
    └── portal/
        ├── index.json      con Frontend y Backend definidos dentro
        └── catalog.json
```

### Índice (`index.json`)

Solo contiene nombres y rutas. El árbol inicial se construye a partir de las rutas, así que `public/e-commerce` aparece como `e-commerce` dentro de `public`:

```json
{
  "diagrams": [
    { "path": "public/e-commerce", "name": "Plataforma e-commerce", "description": "Tienda, gateway, pagos y pedidos." }
  ]
}
```

`path` puede ser una carpeta (se abre su `index.json`) o un fichero `.json`. Por HTTP el índice es obligatorio, porque no se pueden listar carpetas. Con una carpeta local, si no hay índice, se toma como diagrama cada carpeta con un `index.json` que no esté dentro de otra.

### Catálogo (`catalog.json`)

Cada carpeta de diagrama tiene el suyo, junto a su diagrama raíz. Describe una sola vez los nodos y sus dependencias (aristas salientes), para reutilizarlos en el diagrama raíz y en todos sus subdiagramas, aunque estén en subcarpetas:

```json
{
  "version": "1.0",
  "nodes": [
    { "id": "pagos", "type": "microservice", "name": "Pagos", "description": "Markdown", "props": { "tech": "spring" },
      "dependencies": [
        { "target": "stripe", "type": "config", "label": "REST", "technology": "HTTPS", "props": { "method": "POST" } },
        { "target": "pagos-db", "type": "config" }
      ] },
    { "id": "stripe", "type": "externalService", "name": "Stripe" }
  ]
}
```

- `type` de un nodo: el tipo de la paleta (`microservice`, `database`…).
- `type` de una dependencia: su categoría (`config`, `call`, `contains`…). Las referencias la usan para filtrar.
- `kind: "parentChild"` en una dependencia la dibuja de padre a hijo, con el hijo junto al padre.

#### Dependencias y usos

Un nodo tiene dos bloques de aristas salientes, con el mismo formato:

| Bloque | Significado | Cómo se dibuja |
|---|---|---|
| `dependencies` | Relación normal (llama a, carga, configura…) | Flecha hacia la derecha |
| `uses` | Acoplamiento más fuerte: el nodo no funciona sin el otro | Flecha hacia abajo, más gruesa y en color de acento. El nodo usado se coloca debajo. |

```json
{ "id": "mfe-shell", "type": "shellUi", "name": "Shell",
  "dependencies": [ { "target": "mfe-catalogo", "type": "loads" } ],
  "uses":         [ { "target": "mfe-login", "type": "guard", "label": "protege" } ] }
```

- Las reglas de las referencias (`expand`, `outgoing`, `incoming`) e `include` tratan los usos igual que las dependencias, filtrando por su `type`.
- En un diagrama, una arista también puede marcarse como uso con `"uses": true`.
- En un diagrama de arriba abajo (`direction: "TB"`) los usos van hacia la derecha, para que siempre se distingan del flujo principal.

### Diagramas

Cada nodo tiene un `kind`:

| `kind` | Campos | Qué es |
|---|---|---|
| `node` | `type`, `name`, `description`, `props` | Nodo definido en el propio diagrama |
| `ref` | `ref`, `expand`, `outgoing`, `incoming` | Nodo del catálogo. `name`, `description`, `props` y `type` sobrescriben los del catálogo. |
| `diagram` | `file` o `diagram`, `name`, `description` | Otro diagrama: en un fichero (`file`, relativo a este; con `/` inicial, a la raíz) o definido aquí mismo (`diagram`). |

```json
{
  "version": "1.0",
  "title": "Plataforma",
  "description": "Markdown opcional",
  "direction": "LR",
  "nodes": [
    { "id": "cli", "kind": "node", "type": "actor-user", "name": "Clientes" },
    { "id": "pag", "kind": "ref", "ref": "pagos", "expand": "config",
      "incoming": [ { "type": "call", "import": false } ] },
    { "id": "ped", "kind": "diagram", "file": "pedidos/index.json", "name": "Pedidos" }
  ],
  "edges": [
    { "source": "cli", "target": "pag", "label": "HTTPS" }
  ]
}
```

#### Expandir referencias

Una referencia indica qué dependencias del catálogo se pintan (las suyas y las de otros nodos que apuntan a ella), con reglas separadas para salientes (`outgoing`) y entrantes (`incoming`). Cada regla es así:

```json
{ "type": "config", "import": true }
```

- `type`: un tipo de relación o una lista (`["config", "call"]`). Sin `type`, la regla vale para cualquier relación.
- `import: true`: añade el nodo del otro extremo si no está en el diagrama.
- `import: false` (por defecto): solo pinta la relación si ese nodo ya está en el diagrama.

`expand` es un atajo que se suma a esas reglas:

| `expand` | Equivale a |
|---|---|
| `node` (por defecto) | Solo el nodo, sin relaciones |
| `config` | `outgoing: [{ "type": "config", "import": true }]` |
| `all` | Todas las relaciones, salientes y entrantes, importando los nodos |

- Los nodos importados se dibujan con borde discontinuo. No se expanden a su vez.
- Si un nodo del catálogo ya está en el diagrama, se reutiliza.
- La ficha de una referencia muestra sus relaciones en el catálogo y marca cuáles están pintadas.

#### Subdiagramas definidos dentro, `include` y grupos

Un nodo `diagram` puede llevar la definición del subdiagrama en `diagram` en vez de apuntar a un fichero. Con `include` basta con decir qué nodos del catálogo pintar, y con `groups`, cómo agruparlos en cajas:

```json
{ "id": "frontend", "kind": "diagram", "name": "Frontend",
  "diagram": {
    "title": "Frontend",
    "include": [
      { "type": "microFront" }, { "type": "shellUi" },
      { "type": "ext-microfront" }, { "type": "ext-mfe-component" }
    ],
    "groups": [
      { "name": "Internal", "types": ["microFront"], "color": "#8b5cf6", "layout": "box" },
      { "name": "External", "types": ["ext-microfront"], "color": "#f97316", "layout": "box" }
    ]
  } }
```

`include` vale en cualquier diagrama, no solo en los definidos dentro de otro. Cada entrada es un selector; por ahora `{ "type": … }`, preparado para añadir más criterios.

- Incluye **todos los nodos del catálogo** de esos tipos.
- Pinta **todas las relaciones del catálogo** entre los nodos presentes.
- Entre los nodos que traen las referencias (`ref` con `expand`, `outgoing`, `incoming`), deja solo los de esos tipos.
- Los nodos declarados en el diagrama se pintan siempre.
- `"types": ["a", "b"]` se sigue aceptando como forma abreviada de `"include": [{ "type": "a" }, { "type": "b" }]`.

`groups` dibuja una caja con su nombre (`name`) alrededor de los nodos de sus tipos (`types`), con `color`, `description` y `layout` opcionales. Detalles:

- Si un nodo encaja en varios grupos, va al primero.
- Las flechas tienen preferencia: primero cada dependencia lleva su destino a la siguiente columna y cada uso lo coloca debajo. Después, dentro de cada columna, los miembros de un grupo se colocan seguidos y separados de los demás.
- `"layout": "box"` reparte los nodos de la caja en una rejilla lo más cuadrada posible (`ceil(√n)` columnas: 4 → 2×2, 5 → 3+2) en vez de en una sola columna. La columna se ensancha lo necesario.
- Si las flechas reparten un grupo entre varias columnas, cada columna tiene su propia caja con el nombre del grupo (en el ejemplo, Login, que la shell usa, va en una caja «Internal» bajo la shell).
- Al arrastrar la caja se mueven sus nodos; al arrastrar un nodo hacia fuera, la caja crece.

Un subdiagrama definido dentro usa el catálogo de su diagrama raíz y puede contener a su vez otros (`fichero::a::b`).

#### Otros detalles

- Los nodos sin `position` se colocan automáticamente.
- Las aristas no llevan `id`: se calcula siempre como `from:{origen}-to:{destino}`. Si el mismo par se repite, se añade `#2`, `#3`…
- Las aristas del diagrama (`edges`) se pintan siempre, además de las que salen del catálogo. Si ambas unen los mismos nodos, se pinta solo la del diagrama.
- Si un tipo no está en la paleta, o una referencia no está en el catálogo, el nodo se dibuja igualmente, marcado, con un aviso.
- **Compatibilidad**: los ficheros con el formato antiguo, donde `kind` era el tipo (`"kind": "microservice"`) y existía `"kind": "subdiagram"`, se siguen leyendo.

## Arquitectura

Sigue las tres interfaces de `editor de referencia`, recortadas a lo que necesita un visor:

| Interfaz | Dónde | Qué hace |
|---|---|---|
| **Paleta de tipos** | [src/palette](src/palette) | `DiagramElementType` / `DiagramEdgeType`: icono, forma, etiqueta, ficha (`detail`) y acción al pulsar (`open`). `SchemaElement` genera la ficha a partir del JSON Schema de las props. |
| **Fuente de archivos** | [src/storage](src/storage) | `Storage` → `Repository` (`listDiagrams()` para el árbol) → `FileStorage`. Hay dos proveedores: `HttpStorage` y `LocalFolderStorage` (File System Access API o ficheros sueltos). |
| **Control de acceso** | `Storage.gateComponent()` | La pantalla previa a la lectura. En la carpeta local es el permiso de lectura ([FolderAccessGate](src/storage/providers/local-folder/ui/FolderAccessGate.tsx)); por HTTP no hay ninguna. |

La resolución del catálogo está en [src/diagram/resolve.ts](src/diagram/resolve.ts). Convierte diagrama y catálogo en el modelo que se pinta (`ViewModel`), con el `type` efectivo de cada nodo, las referencias expandidas y los nodos importados. Los tipos de la paleta trabajan siempre sobre ese modelo. Los nodos `kind: "diagram"` usan el tipo [`subdiagram`](src/palette/providers/generic/nodes/subdiagram.tsx), cuyo `open()` navega al fichero.

### Añadir un tipo de nodo

```tsx
// src/palette/providers/modular-app/nodes/queue.tsx
import { Inbox } from 'lucide-react';
import { SchemaElement } from '../../../SchemaElement';

export class QueueElement extends SchemaElement {
  kind = 'queue';
  title = 'Cola';
  protected icon = Inbox;
  protected color = '#ea580c';

  definition() {
    return { schema: { type: 'object', properties: { broker: { type: 'string', title: 'Broker' } } } };
  }
}
```

Después se registra en [src/palette/providers/modular-app/index.ts](src/palette/providers/modular-app/index.ts).
