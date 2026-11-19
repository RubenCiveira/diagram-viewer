# Guía para generar catálogos y diagramas del visor

Esta guía describe, de forma completa y normativa, cómo escribir los ficheros JSON que lee el visor de diagramas (`diagram-viewer.html`). Está pensada para que un agente de IA pueda modelar un sistema y producir sus diagramas sin ver el código.

Convenciones:

- **DEBE** / **NO DEBE**: obligatorio. Si no se cumple, el visor muestra un error o pinta algo incorrecto.
- **DEBERÍA**: recomendado.
- Todos los ficheros son JSON (UTF-8, sin comentarios ni comas finales).
- Los textos marcados como *Markdown* admiten Markdown básico (negrita, listas, enlaces, código).
- Hay **JSON Schema** de los tres tipos de fichero y un **validador**: úsalos (ver [§10](#10-json-schema-y-validación)).

---

## 1. Visión general

Una **carpeta de diagramas** contiene:

```
<carpeta>/
├── index.json                 Índice: qué diagramas existen (solo nombres y rutas)
└── <ruta>/<diagrama>/
    ├── index.json             Diagrama raíz de ese diagrama
    ├── catalog.json           Catálogo: nodos y relaciones reutilizables
    ├── catalog/…json          Opcional: partes del catálogo incluidas desde catalog.json
    └── …otros .json           Subdiagramas (en esta carpeta o subcarpetas)
```

Hay tres clases de fichero:

| Fichero | Qué es | Sección |
|---|---|---|
| `<carpeta>/index.json` | **Índice** de diagramas | [§2](#2-índice-de-diagramas-indexjson-de-la-raíz) |
| `<diagrama>/catalog.json` | **Catálogo**: nodos del sistema y sus relaciones | [§3](#3-catálogo-catalogjson) |
| `<diagrama>/index.json` y otros | **Diagramas**: vistas que pintan partes del catálogo | [§4](#4-diagramas) |

Modelo mental:

1. El **catálogo** es la fuente de verdad: cada pieza del sistema (servicio, base de datos, microfrontend…) se describe **una sola vez**, con sus propiedades y sus relaciones salientes.
2. Los **diagramas** son **vistas**: no repiten datos, sino que **referencian** nodos del catálogo y dicen qué relaciones o qué tipos de nodo pintar.
3. Un diagrama puede contener nodos que **abren otros diagramas** (subdiagramas), en fichero aparte o definidos dentro.

---

## 2. Índice de diagramas (`index.json` de la raíz)

Lista los diagramas que el usuario ve en el árbol inicial. **Solo** nombres y rutas.

```json
{
  "diagrams": [
    { "path": "public/portal", "name": "Portal de clientes", "description": "7 microfrontends, gateway y backends." }
  ]
}
```

| Campo | Obligatorio | Descripción |
|---|---|---|
| `diagrams[].path` | sí | Carpeta del diagrama (se abre su `index.json`) o un fichero `.json`. Relativa a la raíz, separada por `/`. |
| `diagrams[].name` | no | Nombre visible. |
| `diagrams[].description` | no | Descripción corta. |

Reglas:

- El índice **DEBE** existir en la raíz si los diagramas se sirven por HTTP (sin él no hay forma de listarlos).
- Cada carpeta de diagrama **DEBERÍA** colgar de una subcarpeta temática (p. ej. `public/…`); el árbol se construye a partir de las rutas.
- El `index.json` de la raíz es un **índice**, nunca un diagrama.

---

## 3. Catálogo (`catalog.json`)

Uno por carpeta de diagrama, junto a su `index.json`. Lo usan el diagrama raíz y **todos** sus subdiagramas, aunque estén en subcarpetas.

```json
{
  "version": "1.0",
  "nodes": [
    {
      "id": "bff-carrito",
      "type": "microservice",
      "name": "bff-carrito",
      "description": "Backend del microfrontend **Carrito**.",
      "props": { "tech": "spring", "baseUrl": "https://bff-carrito.internal" },
      "dependencies": [
        { "target": "api-pagos", "type": "config", "label": "REST" },
        { "target": "mongo", "type": "config", "technology": "MongoDB driver" }
      ]
    },
    { "id": "api-pagos", "type": "api", "name": "API pagos", "props": { "protocol": "https", "basePath": "/payments" } },
    { "id": "mongo", "type": "database", "name": "MongoDB" }
  ]
}
```

### 3.1 Nodo del catálogo

| Campo | Obligatorio | Descripción |
|---|---|---|
| `id` | sí | Identificador **único en el catálogo**. Usa `kebab-case` y un prefijo por familia (`mfe-`, `bff-`, `api-`, `cfg-`, `ext-`…). No lo cambies una vez usado: los diagramas lo referencian. |
| `type` | sí | Tipo del nodo, **texto libre**. Los de la paleta ([§5](#5-tipos-de-nodo-de-la-paleta)) tienen icono, forma y ficha propios; cualquier otro se pinta como nodo genérico. |
| `name` | no | Nombre visible. Si falta, se usa el título del tipo. |
| `description` | no | *Markdown*. Aparece en la ficha y en el inventario impreso. |
| `props` | no | Propiedades del tipo (ver [§5](#5-tipos-de-nodo-de-la-paleta)). Se aceptan claves extra; se muestran tal cual. |
| `dependencies` | no | Relaciones salientes **normales** (llama a, carga, configura…). Se dibujan como flecha **hacia la derecha**. |
| `uses` | no | Relaciones salientes de **acoplamiento fuerte** (no funciona sin el otro). Se dibujan **hacia abajo**, gruesas y destacadas. |
| `nodes` | no | **Nodos internos** (casos de uso, gateways…), con este mismo formato. Ver [§3.5](#35-nodos-internos-nodes). |

### 3.2 Relación (entrada de `dependencies` o `uses`)

| Campo | Obligatorio | Descripción |
|---|---|---|
| `target` | sí | `id` de otro nodo **del mismo catálogo**. |
| `type` | recomendado | Categoría de la relación. Los diagramas filtran por ella. Usa un vocabulario pequeño y consistente (ver abajo). |
| `label` | no | Texto sobre la flecha (p. ej. `HTTPS`, `REST`, `protege`). |
| `technology` | no | Tecnología (p. ej. `JDBC`). Se usa como etiqueta si no hay `label`. |
| `description` | no | *Markdown* para la ficha de la arista. |
| `through` | no | `id` de un nodo intermedio (p. ej. `gateway`). La relación **nunca** se pinta directa: siempre origen → intermedio → destino. |
| `kind` | no | `"parentChild"` la dibuja de padre a hijo (como un uso, sin destacarla). Normalmente prefiere `uses`. |
| `props` | no | Propiedades de la relación. Además, `color`, `animated` (bool) y `dashed` (bool) cambian su aspecto. |

**Vocabulario de `type` recomendado** (puedes ampliarlo, pero sé consistente en todo el catálogo):

| `type` | Significado | Ejemplo |
|---|---|---|
| `config` | Dependencia de configuración/infraestructura propia del nodo | backend → su API, backend → su base de datos, mfe → su configuración |
| `call` | Llamada en tiempo de ejecución a otro servicio | mfe → su backend, backend → servicio compartido |
| `loads` | Un contenedor carga a otro | shell → microfrontend |
| `embeds` | Un microfrontend incrusta un componente | mfe → componente externo |
| `route` | Un gateway enruta hacia un servicio | gateway → backend |
| `proxy-service`, `proxy-api` | Un gateway hace de proxy hacia un servicio externo | gateway → servicio SaaS |
| `guard` | Protección / control de acceso (suele ir en `uses`) | shell → login |
| `contains` | Contención estructural | shell → microfrontend embebido |

El atajo `expand: "config"` de los diagramas (ver [§4.3](#43-expandir-una-referencia)) depende de que uses `config` para las dependencias propias del nodo.

### 3.3 Reglas del catálogo

- Las relaciones se declaran **solo en el nodo de origen**. Las entrantes se calculan solas: **NO** las dupliques en el destino.
- Cada `target` y cada `through` **DEBE** existir en el mismo catálogo.
- Entre dos nodos puede haber varias relaciones de distinto `type`.
- Si una relación pasa por un intermediario (p. ej. mfe → gateway → bff), declárala **una vez** con `through`. El intermediario **DEBERÍA** tener además su propia relación hacia el destino (p. ej. `gateway` → `bff` con `type: "route"`), que el visor reutiliza sin duplicar flechas.

### 3.4 Dividir el catálogo en varios ficheros (`include`)

Un catálogo grande puede repartirse en varios ficheros. `catalog.json` sigue siendo el punto de entrada y lista en `include` los demás:

```json
{
  "version": "1.0",
  "include": ["catalog/pagos.json", "catalog/pedidos.json"],
  "nodes": [
    { "id": "gateway", "type": "gateway", "name": "API Gateway",
      "dependencies": [ { "target": "pagos", "type": "call" } ] }
  ]
}
```

`catalog/pagos.json` tiene **el mismo formato** que un catálogo (`version` es opcional):

```json
{ "nodes": [ { "id": "pagos", "type": "microservice", "name": "Pagos" } ] }
```

| Campo | Obligatorio | Descripción |
|---|---|---|
| `include` | no | Rutas de otros ficheros de catálogo, **relativas al fichero que las declara** (`/` = raíz de la carpeta de diagramas). |

Reglas:

- El visor suma los nodos de todos los ficheros en un **único catálogo**: primero los del propio fichero y luego los de cada `include`, en orden y en profundidad. Las relaciones se calculan sobre el conjunto, así que un `target` o un `through` **PUEDE** apuntar a un nodo de otro fichero.
- Un fichero incluido **PUEDE** tener su propio `include`. Si un fichero llega por dos caminos, se suma una sola vez; los ciclos se ignoran con un aviso.
- Los `id` **DEBEN** ser únicos en el conjunto de ficheros. Si uno se repite, gana la primera definición y se muestra un aviso.
- Si un fichero incluido no existe o no es válido, el visor muestra un aviso y usa el resto.
- Pon las partes en una subcarpeta (p. ej. `catalog/`) y **NO** las llames `index.json` ni `catalog.json`: así no se confunden con diagramas ni con el catálogo de otra carpeta.
- Reparte por dominio o por equipo (pagos, pedidos, frontends…), no por tipo de nodo: así cada fichero describe una zona del sistema con sus relaciones.

### 3.5 Nodos internos (`nodes`)

Un nodo puede describir su estructura interna: un microservicio, sus **casos de uso** (`useCase`) y sus **gateways** (`serviceGateway`, el acceso a una base de datos o a otro sistema). Los internos son nodos con el mismo formato (`id`, `type`, `name`, `props`, `dependencies`, `uses` y, a su vez, `nodes`) y se relacionan entre sí y con el resto del catálogo:

```json
{ "id": "pagos", "type": "microservice", "name": "Pagos",
  "nodes": [
    { "id": "cobrar", "type": "useCase", "name": "Cobrar pedido",
      "dependencies": [ { "target": "stripe-gw", "type": "call" } ] },
    { "id": "stripe-gw", "type": "serviceGateway", "name": "StripeGateway",
      "dependencies": [ { "target": "stripe", "type": "config" } ] }
  ] }
```

**Ids.** El id completo de un interno es `<padre>/<id>` (`pagos/cobrar`; con más niveles, `a/b/c`). Por eso ningún `id` **PUEDE** llevar `/`. El `id` de un interno **DEBE** ser único entre sus hermanos.

**A qué apunta un `target` (o `through`).** Desde un nodo interno se busca primero un **hermano** (`stripe-gw` → `pagos/stripe-gw`), luego subiendo de contenedor en contenedor y, si no, el id tal cual (`stripe`). Desde cualquier nodo se puede apuntar a un interno de otro con su id completo:

```json
{ "id": "crear-pedido", "type": "useCase",
  "dependencies": [ { "target": "pagos/cobrar", "type": "call" } ] }
```

**Cómo se ven.**

- Fuera de su contenedor, los internos **no se pintan**: sus relaciones con el exterior se dibujan desde/hacia el contenedor. Así el contenedor tiene, **sin declararlas**, las dependencias y las entrantes de sus internos:
  - Salientes: el caso de uso usa un gateway y el gateway depende de la base de datos ⇒ se ve `microservicio → base de datos`.
  - Entrantes: una pantalla de un microfront llama a un caso de uso a través del gateway (`"target": "pagos/cobrar", "through": "gateway"`) ⇒ se ve `microfront → gateway → pagos`.
- Fuera de un detalle, estas relaciones derivadas cuentan **como si las declarase el contenedor**: las siguen las reglas de las referencias (`expand`, `outgoing`, `incoming`) y de `include` (por `ref`, y por tipo entre los nodos presentes), con su tipo de relación.
- Si varias acaban entre los mismos dos nodos con el mismo tipo, se pinta una; si el contenedor ya tiene su propia relación con ese nodo, se queda la suya.
- Al pulsar el contenedor se abre su ficha como siempre, con un botón **Ver detalle** (el nodo lleva un distintivo de lupa). El detalle es un diagrama generado con: sus nodos internos, las relaciones entre ellos, las que salen de ellos hacia fuera y las que les llegan de fuera (también a través de un `through`), con los nodos del otro extremo (de borde discontinuo; si son internos de otro nodo, se ve su contenedor).
- El detalle trabaja **solo con relaciones de los internos**. Una relación que llega al contenedor entero (`gateway → pagos`) o que sale de él no aparece, porque no dice a qué interno va: para que se vea, apunta al interno (`"target": "pagos/cobrar"`) o declárala en él.
- En la ficha del contenedor, «Relaciones en el catálogo» incluye las de sus internos, indicando cuál interviene.
- Un diagrama puede referenciar un interno directamente (`"ref": "pagos/cobrar"`) o pintar el detalle de un nodo con el selector `detail` ([§4.4](#44-include-vistas-por-tipo-o-por-nodo)).

Recomendaciones:

- Lleva las relaciones con el exterior a los internos que las tienen (la base de datos, al gateway que la usa; la API, al caso de uso que la expone) en vez de declararlas también en el contenedor: el contenedor ya las muestra.
- Describe los internos solo donde aporten (servicios complejos o críticos); el resto puede quedarse sin `nodes`.

---

## 4. Diagramas

Un diagrama es una vista. Fichero mínimo:

```json
{
  "version": "1.0",
  "title": "Portal de clientes",
  "description": "Vista general. *Markdown*.",
  "nodes": [ … ],
  "edges": [ … ]
}
```

| Campo | Obligatorio | Descripción |
|---|---|---|
| `version` | no | `"1.0"`. |
| `title` | recomendado | Título de la cabecera y de las migas de pan. |
| `description` | no | *Markdown*. |
| `direction` | no | `"LR"` (izquierda→derecha, por defecto) o `"TB"` (arriba→abajo). Usa `TB` si una capa tiene muchos nodos y pocas capas. |
| `nodes` | no | Nodos declarados (ver [§4.1](#41-nodos-declarados)). Puede faltar si el diagrama se define solo con `include`. |
| `edges` | no | Aristas propias del diagrama (ver [§4.2](#42-aristas-del-diagrama)). |
| `include` | no | Selectores de nodos del catálogo (ver [§4.4](#44-include-vistas-por-tipo-o-por-nodo)). |
| `groups` | no | Cajas que agrupan nodos por tipo (ver [§4.6](#46-grupos-groups)). |

### 4.1 Nodos declarados

Cada nodo tiene un `id` (**único dentro del diagrama**) y un `kind`:

| `kind` | Para qué | Campos propios |
|---|---|---|
| `ref` | **Lo habitual.** Pinta un nodo del catálogo. | `ref` (id en el catálogo), `expand`, `outgoing`, `incoming` |
| `diagram` | Un nodo que **abre otro diagrama**. | `file` (ruta a otro .json) **o** `diagram` (definición dentro) |
| `node` | Un nodo que solo existe en este diagrama (no está en el catálogo). | `type`, `props` |

Campos comunes a todos: `name`, `description`, `props` (en `ref` sobrescriben a los del catálogo), `position` (`{ "x": 0, "y": 0 }`, opcional), `width`, `height`, `errors` y `warns` (listas de textos que se muestran como marcas rojas/naranjas).

Ejemplos:

```json
{ "id": "carrito", "kind": "ref", "ref": "mfe-carrito" }
{ "id": "usuario", "kind": "node", "type": "actor-user", "name": "Usuario" }
{ "id": "backend", "kind": "diagram", "file": "backend.json", "name": "Backend" }
{ "id": "nota", "kind": "node", "type": "note", "props": { "text": "Texto *Markdown*", "color": "blue" } }
```

Reglas:

- Prefiere `ref` frente a `node`: lo que está en el catálogo se describe allí.
- `position` **NO** es necesaria: sin ella, el visor coloca los nodos automáticamente. Solo úsala si necesitas un layout fijo.
- Las rutas de `file` son **relativas al diagrama que las contiene**; con `/` inicial, relativas a la raíz de la carpeta de diagramas.

### 4.2 Aristas del diagrama

Aristas que el diagrama dibuja **además** de las que traiga del catálogo. Útiles para unir nodos `node` o `diagram`, que no están en el catálogo.

```json
{ "source": "usuario", "target": "frontend", "label": "HTTPS" }
```

| Campo | Descripción |
|---|---|
| `source`, `target` | `id` de nodos **de este diagrama** (no del catálogo). |
| `label`, `type`, `description`, `technology`, `props` | Como en el catálogo. |
| `uses` | `true` la dibuja como uso (hacia abajo, destacada). |

Reglas:

- **NO** pongas `id` en las aristas: se calcula siempre como `from:<source>-to:<target>`.
- Si el diagrama dibuja una arista entre dos nodos y el catálogo trae otra entre esos mismos nodos, se pinta **solo la del diagrama**.

### 4.3 Expandir una referencia

Un nodo `ref` pinta, por defecto, **solo ese nodo**. Para traer relaciones del catálogo:

```json
{ "id": "gw", "kind": "ref", "ref": "gateway",
  "expand": "config",
  "outgoing": [ { "type": ["proxy-service", "proxy-api"], "import": true } ],
  "incoming": [ { "type": "call", "import": false } ] }
```

- `outgoing` / `incoming`: listas de reglas. Cada regla:
  - `type`: un tipo de relación o una lista. Sin `type`, vale cualquiera.
  - `import`: `true` añade al diagrama el nodo del otro extremo si no está; `false` (por defecto) solo pinta la relación si ese nodo **ya** está en el diagrama.
- `expand` es un atajo que **se suma** a las reglas:

| `expand` | Equivale a |
|---|---|
| `node` (defecto) | sin relaciones |
| `config` | `outgoing: [{ "type": "config", "import": true }]` |
| `all` | todas las salientes y entrantes, importando |

- Los nodos importados se dibujan con borde discontinuo y **no** se expanden a su vez.
- Si un nodo del catálogo ya está en el diagrama (por otra `ref`), se reutiliza.

### 4.4 `include`: vistas por tipo o por nodo

`include` selecciona nodos del catálogo sin declararlos uno a uno. Cada entrada es un **selector**:

**Por tipo** — todos los nodos del catálogo de ese tipo:

```json
"include": [ { "type": "microservice" }, { "type": "database" } ]
```

- Pinta además **todas las relaciones del catálogo entre los nodos presentes**.
- Entre los nodos que traen las `ref` con `expand`/`outgoing`/`incoming`, deja solo los de los tipos incluidos.

**Por nodo** — un nodo y las relaciones que encajen con unos patrones:

```json
"include": [ { "ref": "bff-carrito", "dependencies": "*/*", "uses": "*/*", "incoming": "*/*" } ]
```

- `dependencies`, `uses`: relaciones salientes de ese bloque del nodo.
- `incoming`: relaciones que llegan al nodo desde otros.
- Patrón `"tipoDeRelación/tipoDeNodo"`, con `*` como comodín. El tipo de nodo es el del **otro extremo**. Ejemplos: `"*/*"` (todo), `"call/microservice"`, `"*/api"`, `"config"` (solo el tipo de relación).
- Solo pinta las relaciones que sigue, más los nodos del otro extremo.

**Detalle interno de un nodo** — sus nodos internos ([§3.5](#35-nodos-internos-nodes)), sus relaciones y las que les llegan; es lo que abre el botón «Ver detalle»:

```json
"include": [ { "detail": "pagos" } ]
```

`"types": ["a", "b"]` es una forma abreviada (antigua) de `"include": [{ "type": "a" }, { "type": "b" }]`. Usa `include`.

### 4.5 Subdiagramas

Un nodo `kind: "diagram"` abre otro diagrama al pulsarlo. Tres formas:

**1. En otro fichero:**

```json
{ "id": "pedidos", "kind": "diagram", "file": "pedidos/index.json", "name": "Pedidos" }
```

**2. Definido dentro** (en `diagram`, con el mismo formato que un fichero de diagrama):

```json
{ "id": "backend", "kind": "diagram", "name": "Backend",
  "diagram": {
    "title": "Backend",
    "include": [ { "type": "gateway" }, { "type": "microservice" }, { "type": "database" } ]
  } }
```

**3. Plantilla por cada nodo incluido**: cualquier selector de `include` puede llevar `diagram`. Cada nodo que incluye ese selector abre un subdiagrama generado a partir de la plantilla, en la que `"$self"` se sustituye por el id de ese nodo:

```json
"include": [
  { "type": "microFront",
    "diagram": {
      "description": "El microfrontend con todas sus relaciones.",
      "include": [ { "ref": "$self", "dependencies": "*/*", "uses": "*/*", "incoming": "*/*" } ]
    } }
]
```

- Si la plantilla no tiene `title`, el subdiagrama toma el `name` del nodo.
- Los subdiagramas (de las tres formas) usan el catálogo del diagrama raíz.
- Se pueden anidar (un subdiagrama dentro de otro).

### 4.6 Grupos (`groups`)

Cajas con nombre que envuelven a los nodos de ciertos tipos:

```json
"groups": [
  { "name": "Internal", "types": ["microFront"], "color": "#8b5cf6", "layout": "box" },
  { "name": "External", "types": ["ext-microfront"], "color": "#f97316", "layout": "box", "explicit": true }
]
```

| Campo | Descripción |
|---|---|
| `name` | Título de la caja. |
| `types` | Tipos de nodo que entran en la caja. Si un nodo encaja en varios grupos, va al primero. |
| `color` | Color de acento (`#rrggbb`). |
| `description` | Texto al pasar el ratón. |
| `layout` | `"box"`: reparte los nodos en rejilla cuadrada. Sin él, en columna. |
| `explicit` | `true`: pinta la caja aunque envuelva a un solo nodo (por defecto no se pinta). |

Las flechas tienen prioridad: primero se colocan los nodos según sus relaciones y después se agrupan en cada columna. Si las relaciones reparten un grupo entre varias columnas, cada columna tiene su propia caja.

---

## 5. Tipos de nodo de la paleta

`type` es **texto libre**. Estos son los tipos que el visor conoce: tienen icono, forma y una ficha con sus propiedades. Un tipo que no esté en la lista se pinta igualmente como nodo genérico (icono de interrogación), con sus `props` tal cual. Usa estos siempre que encajen y crea tipos nuevos solo cuando ninguno sirva; en ese caso, sé consistente en todo el catálogo.

| `type` | Qué representa | `props` (todas opcionales) |
|---|---|---|
| `actor-user` | Persona o rol que usa el sistema | `category`: `Empleado` \| `Cliente` \| `Publico` \| `Operador` |
| `shellUi` | Aplicación contenedora (shell) que carga microfrontends | `routeBase`, `authRequired` (bool) |
| `microFront` | Microfrontend propio | `route`, `remoteEntryUrl`, `exposedModule`, `version`, `dependsOn` (lista) |
| `ext-microfront` | Página completa de otro equipo cargada por la shell | `team`, `contact`, `route`, `remoteEntryUrl`, `exposedModule`, `version` |
| `ext-mfe-component` | Componente de otro equipo incrustado en un microfrontend | `team`, `contact`, `remoteEntryUrl`, `exposedModule`, `version` |
| `remoteConfig` | Configuración remota que carga un microfrontend | `source`, `format`: `json` \| `yaml` \| `env`, `refresh`, `flags` (lista) |
| `gateway` | API gateway de entrada | `namePattern`, `entryHost`, `entryPath`, `rateLimit` (número) |
| `gatewayProxy` | Regla de proxy del gateway | `path`, `targetUrl`, `rewrite`, `cors` (bool), `cacheTtl` (entero) |
| `remoteOAuth` | Proxy de autenticación OAuth | `path`, `targetUrl`, `rewrite`, `cors` (bool), `cacheTtl` (entero) |
| `microservice` | Servicio backend (incluidos BFF) | `tech`: `quarkus` \| `spring` \| `php-slim` \| `node`, `baseUrl` |
| `useCase` | Caso de uso de un servicio (nodo interno, [§3.5](#35-nodos-internos-nodes)) | `trigger` (REST, evento, batch…), `endpoint`, `transactional` (bool) |
| `screen` | Pantalla de un microfrontend (nodo interno) | `route`, `component` |
| `serviceGateway` | Gateway (adaptador) de un servicio hacia una base de datos u otro sistema (nodo interno) | `port` (interfaz), `client` (librería) |
| `api` | API (contrato) que consume un servicio | `protocol`: `http` \| `https` \| `grpc`, `auth`: `none` \| `basic` \| `oauth`, `basePath`, `version`, `specUrl` |
| `database` | Base de datos | `tech`, `baseUrl` |
| `externalService` | Servicio REST externo | `type`, `name`, `endpoint`, `notes` |
| `externalSoap` | Web service SOAP externo | `type`, `name`, `endpoint`, `notes` |
| `externalTransaction` | Sistema transaccional externo (ERP, host…) | `type`, `name`, `endpoint`, `notes` |
| `note` | Nota de texto en el lienzo (solo `kind: "node"`) | `text` (*Markdown*), `color`: `yellow` \| `blue` \| `green` \| `pink` |

Además, en cualquier nodo:

- `props.description` (*Markdown*) se usa como descripción si el nodo no tiene `description`.
- En nodos `kind: "diagram"`, `props.color` cambia el color de la tarjeta apilada.

Las aristas `microservice` → `externalService`, `externalSoap` o `externalTransaction` se reconocen como petición REST, SOAP o transacción (etiqueta automática `REST`/`SOAP`/`TX`). Sus `props` admiten: REST `path`, `method`, `connection` (`readTimeout`, `writeTimeout`, `connectTimeout`), `retry` (`maxAttempts`, `backoff`); SOAP `name`, `connection`; TX `code`, `host`.

---

## 6. Procedimiento recomendado para un agente

1. **Inventario.** Enumera las piezas del sistema y asígnales un `type` de [§5](#5-tipos-de-nodo-de-la-paleta) y un `id` estable con prefijo.
2. **Catálogo.** Escribe `catalog.json` con un nodo por pieza: `name`, `description` y `props` con lo que sepas. No inventes datos: deja fuera lo desconocido.
3. **Relaciones.** En cada nodo, declara sus relaciones salientes:
   - Dependencias propias (sus APIs, su base de datos, su configuración) → `dependencies` con `type: "config"`.
   - Llamadas a otros servicios → `dependencies` con `type: "call"` (y `through` si pasan por un gateway).
   - Acoplamientos fuertes (no funciona sin el otro) → `uses`.
4. **Diagrama raíz.** Una vista general con pocos nodos (5-10): actores (`kind: "node"`), piezas clave (`kind: "ref"`) y áreas que se detallan en subdiagramas (`kind: "diagram"`). Une con `edges` lo que no venga del catálogo.
5. **Subdiagramas.** Una vista por área, normalmente definida dentro con `include` por tipo, más `groups` si ayudan a leerla. Para ver una pieza con todas sus relaciones, usa una plantilla `include` + `"$self"`.
6. **Índice.** Añade la carpeta al `index.json` de la raíz.
7. **Comprobación.** Ejecuta `pnpm run validate <carpeta> --strict` hasta que no haya errores ni avisos ([§10](#10-json-schema-y-validación)) y repasa la lista de [§8](#8-lista-de-comprobación).

Criterios de legibilidad:

- Un diagrama **DEBERÍA** tener como mucho unos 25 nodos. Si hay más, divide en subdiagramas.
- Usa `direction: "TB"` cuando una columna tenga muchos nodos (p. ej. un backend con muchas APIs).
- Usa `groups` con `layout: "box"` para bloques de 4 o más nodos del mismo tipo.

---

## 7. Ejemplo completo mínimo

`index.json` (raíz):

```json
{ "diagrams": [ { "path": "public/tienda", "name": "Tienda" } ] }
```

`public/tienda/catalog.json`:

```json
{
  "version": "1.0",
  "nodes": [
    { "id": "mfe-shell", "type": "shellUi", "name": "Shell",
      "dependencies": [ { "target": "mfe-catalogo", "type": "loads" } ],
      "uses": [ { "target": "mfe-login", "type": "guard", "label": "protege" } ] },
    { "id": "mfe-login", "type": "microFront", "name": "Login", "props": { "route": "/login" } },
    { "id": "mfe-catalogo", "type": "microFront", "name": "Catálogo", "props": { "route": "/catalogo" },
      "dependencies": [ { "target": "bff-catalogo", "type": "call", "label": "HTTPS", "through": "gateway" } ] },
    { "id": "gateway", "type": "gateway", "name": "API Gateway",
      "dependencies": [ { "target": "bff-catalogo", "type": "route" } ] },
    { "id": "bff-catalogo", "type": "microservice", "name": "bff-catalogo", "props": { "tech": "quarkus" },
      "dependencies": [
        { "target": "api-productos", "type": "config", "label": "REST" },
        { "target": "mongo", "type": "config", "technology": "MongoDB driver" }
      ] },
    { "id": "api-productos", "type": "api", "name": "API productos", "props": { "protocol": "https", "basePath": "/products" } },
    { "id": "mongo", "type": "database", "name": "MongoDB" }
  ]
}
```

`public/tienda/index.json`:

```json
{
  "version": "1.0",
  "title": "Tienda",
  "description": "El usuario entra por el frontend, que llama al backend a través del gateway.",
  "nodes": [
    { "id": "usuario", "kind": "node", "type": "actor-user", "name": "Usuario" },
    { "id": "frontend", "kind": "diagram", "name": "Frontend",
      "diagram": {
        "title": "Frontend",
        "include": [
          { "type": "shellUi" },
          { "type": "microFront",
            "diagram": { "include": [ { "ref": "$self", "dependencies": "*/*", "uses": "*/*", "incoming": "*/*" } ] } }
        ],
        "groups": [ { "name": "Microfrontends", "types": ["microFront"], "layout": "box" } ]
      } },
    { "id": "gateway", "kind": "ref", "ref": "gateway" },
    { "id": "backend", "kind": "diagram", "name": "Backend",
      "diagram": {
        "title": "Backend",
        "direction": "TB",
        "include": [ { "type": "microservice" }, { "type": "api" }, { "type": "database" } ]
      } }
  ],
  "edges": [
    { "source": "usuario", "target": "frontend" },
    { "source": "frontend", "target": "gateway", "label": "HTTPS" },
    { "source": "gateway", "target": "backend", "label": "REST" }
  ]
}
```

---

## 8. Lista de comprobación

Antes de dar por terminado un conjunto de diagramas, verifica:

- [ ] `pnpm run validate <carpeta> --strict` termina sin errores ni avisos (cubre la mayoría de los puntos siguientes).
- [ ] Todos los ficheros son JSON válido (sin comentarios ni comas finales).
- [ ] El `index.json` de la raíz es un índice (`diagrams`) y contiene la nueva carpeta.
- [ ] Cada carpeta de diagrama tiene su `index.json` y, si usa `ref` o `include`, su `catalog.json`.
- [ ] Los `id` del catálogo son únicos (en todos sus ficheros, si usa `include`); los `id` de los nodos de cada diagrama son únicos en ese diagrama.
- [ ] Los `type` de nodo son de [§5](#5-tipos-de-nodo-de-la-paleta) salvo que ninguno encaje, y los tipos nuevos se escriben igual en todo el catálogo.
- [ ] Cada `target` y `through` del catálogo, y cada `ref` de los diagramas, existe en el catálogo de esa carpeta (los internos, como `<padre>/<id>` o como hermanos).
- [ ] Ningún `id` del catálogo lleva `/`, y los de los nodos internos son únicos entre hermanos.
- [ ] Cada `source`/`target` de `edges` es un `id` de nodo **del propio diagrama**.
- [ ] Ninguna arista lleva `id`.
- [ ] Las relaciones entrantes **no** están duplicadas en el nodo de destino.
- [ ] Los `file` de los subdiagramas apuntan a ficheros que existen (rutas relativas al diagrama que los contiene).
- [ ] Ningún diagrama supera unos 25 nodos sin dividirse en subdiagramas.

Cómo comprobarlo con el visor: abre `diagram-viewer.html` en la carpeta (o sírvela con `python3 -m http.server`). Los problemas aparecen como:

- un aviso rojo en la parte inferior (JSON inválido, aristas a nodos inexistentes, referencias no resueltas);
- nodos con icono de enlace roto (referencia que no está en el catálogo) o de interrogación (tipo sin icono propio: compruébalo si no era intencionado);
- marcas rojas o naranjas en los nodos con `errors` o `warns`.

---

## 9. Formato antiguo (no usar)

El visor sigue leyendo, por compatibilidad, diagramas donde `kind` era el tipo del nodo (`"kind": "microservice"`) y subdiagramas con `"kind": "subdiagram"` y `props.file`. **NO** generes ese formato: usa `kind: "node"` + `type`, y `kind: "diagram"` + `file`.

---

## 10. JSON Schema y validación

Los schemas están en [`docs/schemas/`](schemas/):

| Fichero | Schema |
|---|---|
| `index.json` de la raíz | [`index.schema.json`](schemas/index.schema.json) |
| `catalog.json` | [`catalog.schema.json`](schemas/catalog.schema.json) |
| Cualquier otro `.json` (diagramas) | [`diagram.schema.json`](schemas/diagram.schema.json) |

Son JSON Schema draft-07, con una descripción en cada campo. Son **más estrictos que el visor**:

- Los `type` de nodos y relaciones son texto libre. Los tipos de la paleta aparecen como `examples` en el schema.
- `kind` solo admite `ref`, `diagram` y `node` (no el formato antiguo).
- Exigen los campos que necesita cada `kind`: `ref` en `kind: "ref"`, `type` en `kind: "node"`, `file` o `diagram` en `kind: "diagram"`, y `type` o `ref` en cada selector de `include`.
- **No admiten campos desconocidos**, para detectar erratas como `"dpendencies"`. Las claves libres solo van dentro de `props`.

Cómo usarlos:

- **Validar una carpeta completa**:

  ```bash
  pnpm run validate <carpeta>            # falla solo con errores de formato
  pnpm run validate <carpeta> --strict   # falla también con avisos funcionales
  ```

  Distingue dos niveles:

  | Nivel | Qué es | Ejemplos | ¿Hace fallar el comando? |
  |---|---|---|---|
  | **Error de formato** | El fichero no es JSON o no cumple su schema: está mal formado | campo desconocido (`"dpendencies"`), `kind` inválido, `ref` sin su campo `ref`, `id` en una arista | Sí (código 1) |
  | **Aviso funcional** | El fichero está bien formado, pero una referencia no se resuelve. El visor lo tolera: pinta el nodo marcado y muestra un aviso | `ref` o `through` que no están en el catálogo, `file` inexistente, arista hacia un nodo que no está en el diagrama, `id` duplicado, carpeta del índice inexistente | Solo con `--strict` |

  Cada mensaje indica el fichero y la ruta JSON (p. ej. `/nodes/4 must have required property 'ref'`). Un agente **DEBERÍA** usar `--strict`, salvo que una referencia rota sea intencionada.
- **Salida estructurada**: si generas los ficheros con una API que admite JSON Schema (structured outputs, function calling), pasa el schema correspondiente.
- **Editores**: un fichero puede declarar su schema con `"$schema": "<ruta relativa>/diagram.schema.json"`. El visor ignora ese campo.

Los schemas se generan a partir de los mismos validadores que usa el visor (`src/diagram/model.ts`) y de la lista de tipos de la paleta, con `pnpm run schemas`. No los edites a mano: si cambia el formato o se añade un tipo de nodo, vuelve a generarlos.

