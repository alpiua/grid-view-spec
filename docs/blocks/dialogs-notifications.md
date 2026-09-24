# Confirmation Dialogs and Notifications

GridViewSpec provides unified, theme-aware confirmation dialogs and toast notifications. When
delegated grid actions bind, the runtime installs idempotent global dialog adapters: `window.confirm`
returns the `Promise<boolean>` from a danger-toned GridViewSpec dialog, and `window.alert` posts an
error notification with the native alert as a failure fallback. Use the explicit `GridView.confirm`
and `GridView.notify` APIs when application code can depend on GridViewSpec directly.

Managed GridView action, cell-action, and link dispatch paths own `[data-cm-confirm]` JSON
attributes. Cancellation prevents the managed action; acceptance invokes it once. Plain DOM
buttons, links, and forms are not intercepted by this attribute. The runtime also adapts global
`window.confirm` and `window.alert` during boot and bridges `htmx:confirm`: acceptance calls
`issueRequest(true)` once, while cancellation issues no request.

---

## 1. Architectural Overview

GridViewSpec's feedback system operates across two complementary layers:

1. **Modal Confirmation Layer (`GridView.confirm`)**:
   - For blocking, high-intent decisions (e.g. destructive actions, discarding changes, irreversible commits).
   - Promise-based asynchronous flow returning `boolean`.
   - Utilizes standard HTML5 `<dialog>` (`showModal()`) placed in the browser's top layer.
   - Preserves focus management, escape-key handling, and backdrop dismissal without z-index collisions.

2. **Toast Notification Stack (`GridView.notify` / `cm:notify`)**:
   - For non-blocking status updates, telemetry, action receipts, and subsystem alerts.
   - Multi-channel event emitter: any island, AG-Grid callback, or HTMX response header can publish notifications.
   - Configurable tone levels, auto-dismiss timers, action buttons, and hover-pause behavior.
   - Fixed-position non-intrusive container (`z-index: var(--cm-z-toast, 1600)`).

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Page Host / HTMX Layout                         │
│                                                                        │
│  ┌───────────────────────┐              ┌───────────────────────────┐  │
│  │ HTMX Trigger Header   │              │ Components / Micro-UIs    │  │
│  │ HX-Trigger: cm:notify │              │ GridView.confirm(...)     │  │
│  └───────────┬───────────┘              └─────────────┬─────────────┘  │
│              │                                        │                │
│              ▼                                        ▼                │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                   GridView Core Runtime                          │  │
│  │                                                                  │  │
│  │  ┌────────────────────────────┐    ┌──────────────────────────┐  │  │
│  │  │   Notification Manager     │    │   Dialog Manager         │  │  │
│  │  │   - Toast queue & stack    │    │   - Promise resolver     │  │  │
│  │  │   - Auto-dismiss timers    │    │   - Focus trap (<dialog>)│  │  │
│  │  │   - Tone styles & icons    │    │   - Destructive styling  │  │  │
│  │  └──────────────┬─────────────┘    └─────────────┬────────────┘  │  │
│  └─────────────────┼────────────────────────────────┼───────────────┘  │
│                    ▼                                ▼                  │
│  ┌──────────────────────────────┐     ┌─────────────────────────────┐  │
│  │ #cm-toast-container (Fixed)  │     │ <dialog class="cm-dialog">  │  │
│  │ (Top-Right Toast Stack)      │     │ (Top-Layer Modal Window)    │  │
│  └──────────────────────────────┘     └─────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Confirmation Dialogs (`GridView.confirm`)

### 2.1 Programmatic Usage

Call `GridView.confirm` from any script or action handler:

```typescript
const confirmed = await window.GridView.confirm({
  title: "Delete Category?",
  message: "All associations with products in this category will be removed.",
  tone: "danger",
  confirmText: "Delete",
  cancelText: "Cancel",
});

if (confirmed) {
  await executeDelete();
}
```

### 2.2 Configuration Options

| Option | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | `"Confirmation"` | Header text of the dialog. |
| `message` | `string` | `""` | Explanatory message or details of the action. |
| `tone` | `"default" \| "primary" \| "warning" \| "danger"` | `"default"` | Semantic tone. `"danger"` emphasizes destructive actions with error color tokens. |
| `confirmText` | `string` | `"Confirm"` | Label for the confirmation button. |
| `cancelText` | `string` | `"Cancel"` | Label for the cancellation button. |
| `closeOnBackdrop` | `boolean` | `true` | Whether clicking the backdrop cancels the confirmation. |

### 2.3 Declarative Confirmation in Actions

GridViewSpec actions (such as `GridViewButtonAction`, a table `row_action`, and
`[data-cm-cell-action]`) support declarative confirmation:

```json
{
  "action": "delete_item",
  "confirm": {
    "title": "Remove item?",
    "message": "Are you sure you want to remove this item?",
    "tone": "danger",
    "confirm_text": "Remove",
    "cancel_text": "Cancel",
    "close_on_backdrop": true
  }
}
```

This declarative JSON is the wire/Python shape: confirmation object keys use snake_case, and
`confirm` may also be a string. The programmatic `GridView.confirm` API above uses its typed
JavaScript camelCase options (`confirmText`, `cancelText`, and `closeOnBackdrop`).

Or via DOM attributes:

```html
<button
  type="button"
  data-cm-cell-action="delete"
  data-cm-confirm='{"title":"Delete row?","tone":"danger"}'
  data-cm-row-id="123"
>
  Delete
</button>
```

When clicked, the delegated action dispatcher awaits `GridView.confirm` before invoking the action callback.

---

## 3. Toast Notifications (`GridView.notify`)

### 3.1 Programmatic Usage

```typescript
// Simple notification
window.GridView.notify("Record saved successfully");

// Structured notification
window.GridView.notify({
  title: "Inventory Synced",
  message: "Updated stock counts for 1,420 SKUs.",
  tone: "success",
  duration: 5000,
});
```

### 3.2 Tones and Attention Levels

* `info` (default): Neutral information or general operational updates.
* `success`: Operation completed successfully.
* `warning`: Requires user attention or non-critical issue.
* `danger` / `error`: Operation failed or critical error occurred.

### 3.3 Event-Driven Channel (`cm:notify`)

Subsystems communicate with the notification system via standard DOM events:

```javascript
window.dispatchEvent(
  new CustomEvent("cm:notify", {
    detail: {
      message: "Background export ready",
      tone: "info",
      action: {
        label: "Download",
        onClick: () => window.open("/export/file.xlsx"),
      },
    },
  })
);
```

### 3.4 HTMX Server-Triggered Notifications

Backend controllers trigger notifications through HTMX response headers:

```http
HTTP/1.1 200 OK
Content-Type: text/html
HX-Trigger: {"cm:notify": {"message": "Category updated", "tone": "success"}}
```

The GVS runtime listens for `cm:notify` dispatched on `window` or document elements and routes it to the toast presenter.

---

## 4. Stacking and Styling Tokens

Both systems adhere strictly to the GridViewSpec token system defined in `tokens.css`:

```css
:root {
  --cm-z-dialog: 1500;
  --cm-z-toast: 1600;

  --cm-toast-width: 360px;
  --cm-toast-max-width: calc(100vw - 32px);
  --cm-toast-radius: 8px;
  --cm-toast-bg: var(--cm-surface);
  --cm-toast-border: var(--cm-border);
  --cm-toast-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
```

When HTML5 `<dialog>` is used with `showModal()`, the dialog is automatically promoted to the browser's top layer, preventing clipping by parent containers with `overflow: hidden` or lower `z-index`.
