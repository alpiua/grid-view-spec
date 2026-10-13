/** Named registries for vNext GridViewSpec host extensions. */

export type GridActionContext = {
  rowId?: string;
  gridId?: string;
  params?: Record<string, unknown>;
  selectedValue?: string;
  event?: Event;
  source?: "row" | "cell" | "batch" | "keyboard";
};

export type GridCommitContext = {
  rowId?: string;
  gridId?: string;
  columnId?: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
};

export type GridCommitHandler = (
  ctx: GridCommitContext
) => void | boolean | Promise<void | boolean>;

export type GridDropContext = {
  treeId: string;
  sourceId: string;
  targetId: string;
  sourceType: string;
  targetType: string;
  position: "inside" | "before" | "after";
};

export type GridDropHandler = (ctx: GridDropContext) => boolean | Promise<boolean>;

export type GridActionHandler = (ctx: GridActionContext) => void;

const _renderers = new Map<string, (ctx: Record<string, unknown>) => string | HTMLElement>();
const _commits = new Map<string, GridCommitHandler>();
const _actions = new Map<string, GridActionHandler>();
const _drops = new Map<string, GridDropHandler>();

export function registerRenderer(
  name: string,
  fn: (ctx: Record<string, unknown>) => string | HTMLElement
): void {
  if (!name || typeof fn !== "function") return;
  _renderers.set(name, fn);
}

export function registerCommit(name: string, fn: GridCommitHandler): void {
  if (!name || typeof fn !== "function") return;
  _commits.set(name, fn);
}

export function registerAction(name: string, fn: GridActionHandler): void {
  if (!name || typeof fn !== "function") return;
  _actions.set(name, fn);
}

export function registerDrop(name: string, fn: GridDropHandler): void {
  if (!name || typeof fn !== "function") return;
  _drops.set(name, fn);
}

export async function invokeDrop(name: string, ctx: GridDropContext): Promise<boolean> {
  const fn = _drops.get(name);
  if (typeof fn !== "function") return false;
  try {
    return (await fn(ctx)) === true;
  } catch {
    return false;
  }
}

export function invokeAction(name: string, ctx: GridActionContext): void {
  const fn = _actions.get(name);
  if (typeof fn === "function") fn(ctx);
}

export async function invokeCommit(
  name: string,
  ctx: GridCommitContext
): Promise<boolean> {
  const fn = _commits.get(name);
  if (typeof fn !== "function") return false;
  const result = await fn(ctx);
  return result !== false;
}

export function getRegisteredRenderer(
  name: string
): ((ctx: Record<string, unknown>) => string | HTMLElement) | undefined {
  return _renderers.get(name);
}
