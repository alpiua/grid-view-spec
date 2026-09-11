# Browser page state

`GridView.PageState` persists opaque JSON for one rendered GridViewSpec page in
browser `localStorage`. It retains browser-local UI state across reloads for the
same origin. It does not provide reactivity, UI behavior, domain drafts, or server
persistence.

## State sources

GridViewSpec provides two persistence mechanisms:

| Mechanism | Identity | Use | Authority |
|---|---|---|---|
| `GridView.PageState` | `spec.id` + optional scope + namespace | Browser-local persistent UI layout and renderer state | Browser |
| `GridPreference` | Authenticated user + `grid_id` | Named presets and saved searches | Host persistence backend |

The URL is authoritative shareable request state, not a persistence mechanism.
URL values win when present.
`GridView.PageState` is not a server session. `GridPreference` is not a general
page-state store.

## Identity and scope

`spec.id` is the primary page-state identity. Set
`GridViewConfig.page_state_scope` only when the same spec intentionally renders in
separate browser contexts. The renderer emits the scope as
`data-cm-page-state-scope` on the spec root.

```python
from grid_view_spec.types import GridViewConfig, GridViewSpec

spec = GridViewSpec(
    id="catalogue",
    config=GridViewConfig(page_state_scope="workspace"),
    blocks=(...),
)
```

An empty `page_state_scope` is the default. Browser storage already isolates
origins, so a scope does not encode a host name or origin.

## Host setup

A rendered spec and the core GridViewSpec JavaScript bundle are sufficient. The
package emits the root identity attributes. A host does not add a Django migration,
HTTP route, `GridViewHost` method, or storage configuration for page state. Use
`page_state_scope` only when a default `spec.id` identity needs intentional
separation.

## JavaScript API

Get a handle from the connected spec root or one of its descendants. UI mounted
outside the spec root passes the root explicitly.

```js
const root = document.getElementById("cm-spec-catalogue");
const state = GridView.PageState.forRoot(root);

if (state) {
  const drawer = state.get("layout.drawer");
  state.put("layout.drawer", { open: true, width: 480 });
  state.remove("layout.drawer");
}
```

| Method | Result |
|---|---|
| `get(namespace)` | Stored JSON value or `undefined` |
| `put(namespace, value)` | Replaces one namespace value |
| `remove(namespace)` | Removes one namespace value |

Values must be JSON-serializable. Malformed stored data reads as absent; a later
valid `put` replaces it. Unavailable or full browser storage returns no value and
does not persist writes. The handle does not observe changes or validate the
host-owned value shape.

## Namespaces

Use stable namespaces so independent capabilities do not overwrite each other.

| Namespace | Owner and contents |
|---|---|
| `layout.drawer` | Host drawer layout snapshot |
| `layout.filters` | Host filter-panel layout snapshot |
| `layout.modal` | Host modal layout snapshot |
| `grid.<block-id>.columns` | Shared table column layout |
| `grid.<block-id>.ag_grid` | AG Grid renderer-specific state |
| `host.<app>.*` | Host-owned opaque JSON |

The package does not interpret host namespaces. Each renderer restores its own
namespaces. When a namespace mirrors a URL value, the host gives the URL value
precedence.

Table adapters use the literal block id in their namespace. The shared
`grid.<block-id>.columns` value is an ordered array of
`{ id, hidden, pinned?, width? }`; it is independent of a table renderer. An AG
Grid adapter keeps its filter, sort, flex-sizing, and other AG-only values in
the adjacent `grid.<block-id>.ag_grid` namespace.

## Storage boundary

`GridView.PageState` exposes browser-local `get`, `put`, and `remove` only. It does
not expose a universal storage selector such as `put(session, namespace, value)`:
browser-local state and authenticated named preferences have different identity,
authorization, lifecycle, and failure semantics. Hosts can use the same verbs in
their own adapters without expanding the public GridViewSpec contract.

## Upgrade compatibility

Existing `GridPreference` data and its host API remain unchanged. Renderer adapters
migrate supported legacy browser grid keys once and clear obsolete keys, then write
only the page-state namespaces. Named presets and saved searches remain untouched.

See [Saved preferences](preferences.md) for user-managed named views.
