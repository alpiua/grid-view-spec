# Column settings

```python
GridViewTable(
    settings=("drawer", "modal"),  # None, ("drawer",), ("modal",), or both
)
```

`settings` selects column-settings surfaces explicitly: `("drawer",)` adds the
Settings tab to a target filter drawer; `("modal",)` renders the modal and
toolbar gear; `("drawer", "modal")` does both. `None` disables column settings.

## Features

| Feature | Behavior |
|---------|----------|
| Drag reorder | SortableJS (host base template CDN) |
| Show/hide | Per column or column group |
| Pin L/R | Standalone columns |
| Named presets | `GridPreference.col_presets` |
| Session state | `localStorage` per `grid_id` |

Simple table and AG-Grid share one column-settings host (`GridView.createColumnSettings`)
for both surfaces.

The renderer owns gear placement. `GridViewButtonAction` has no built-in
`action="table_settings"` handler; use `GridViewTable.settings` and the rendered
control rather than declaring a non-functional action.

## Persistence layers

| Layer | Storage |
|-------|---------|
| Session | `localStorage` — column layout, filters, quick search |
| Named presets | `GridPreference` via `POST api_grid_preferences` |

See [Preferences](../persistence/preferences.md).
