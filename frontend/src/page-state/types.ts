import type { JsonValue } from "../types/generated/grid-view-spec";

/** JSON value persisted by the renderer-neutral page-state store. */
export type { JsonValue };

/**
 * A namespaced, browser-local preference store for one rendered GridViewSpec.
 *
 * Values are serialized only. This handle does not observe, interpret, or
 * synchronize application state.
 */
export interface PageStateHandle {
  get: (namespace: string) => JsonValue | undefined;
  put: (namespace: string, value: JsonValue) => void;
  remove: (namespace: string) => void;
}

/** Entry point for page-state handles attached to rendered spec roots. */
export interface PageStateApi {
  forRoot: (root: Element | null | undefined) => PageStateHandle | null;
}
