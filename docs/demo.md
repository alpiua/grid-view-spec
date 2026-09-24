# Interactive Demo Showcase

The official interactive demo application is hosted at **[github.com/alpiua/grid-view-spec-demo](https://github.com/alpiua/grid-view-spec-demo)**.

It demonstrates the exact contract boundary between host applications and GridViewSpec:
the host owns rows, database queries, business endpoints, and export handlers; GridViewSpec owns declarative specification validation, HTML/JSON rendering, and the client runtime.

---

## Quick Start

Run the demo locally with `uv`:

```bash
git clone https://github.com/alpiua/grid-view-spec-demo.git
cd grid-view-spec-demo
uv sync --all-groups
make live
```

Open **`http://127.0.0.1:8383/`** in your browser.

> [!NOTE]
> The demo uses in-memory and synthetic dataset generators (`demo/data.py`). No external database setup or database migrations are required to start exploring.

---

## Showcase Pages

| Path | Showcase | Key Features Demonstrated |
| :--- | :--- | :--- |
| `/` | **Overview & Quick Start** | Contract boundary, import maps, quick start guides |
| `/elements/<slug>/` | **Component Catalog** | Interactive sandbox for all 17+ block types and renderers |
| `/simple/` | **Simple Table** | Lightweight HTML table, search syntax, faceted filters, column settings, exports |
| `/data-grid/` | **AG Grid Enterprise** | High-performance virtualized grid, server datasource, browser-local `PageState` |
| `/example/` | **Analytics Dashboard** | Complete KPI metrics, interactive charts, card groups, fused table-card shell |
| `/workflows/` | **Forms & Editing** | Form blocks, localized contracts, inline cell editing, mutate actions |
| `/composition/` | **Layout Composition** | Split areas (sidebar / main), tabbed workspaces, responsive mobile adaptation |
| `/schema/` | **Validation Lab** | Raw wire JSON inspection, `validate_spec` error diagnostics, round-trip decoding |
| `/mcp/` | **MCP Server Tools** | Model Context Protocol integration, AI coding agent schemas and visualizers |
| `/install/` | **Host Integration** | Ready-to-copy setup for Django and Starlette hosts |

---

## Key Architectural Patterns Demonstrated

### 1. Scoped PageState Persistence
The `/data-grid/` demo showcases `GridView.PageState.forRoot(...)`. Grid state (column widths, visibility, sort order) and host layout state (drawer open/closed, split widths) persist in browser `localStorage` under a scoped specification root without requiring database models, server sessions, or custom API endpoints.

### 2. Multi-Backend Rendering
Demonstrates how the identical `GridViewSpec` structure seamlessly switches between:
- **Simple Table (`simple_table`)**: Zero frontend dependencies, standard HTML table, ideal for SSR and low-bandwidth environments.
- **AG Grid (`ag_grid`)**: Client-side virtualized rendering with infinite query scrolling and column reordering.

### 3. Mobile & Viewport Adaptation
Every showcase in the demo application is tested across viewport sizes:
- Split layouts collapse from horizontal rows to vertical stacks on mobile (`<= 768px`).
- Filter panels and column settings adapt to touch-friendly dialogs.
- Table viewports enable smooth touch inertia scrolling with sticky header chrome.
