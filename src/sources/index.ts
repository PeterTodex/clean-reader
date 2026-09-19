import { BookSource, SourceMeta } from './types';
import {
  RuleBasedSource,
  RuleBookSourceConfig,
  RuleSourceMeta,
  RuleSearchConfig,
  RuleDetailConfig,
  RuleChapterConfig,
} from './rule-engine';

const CUSTOM_RULES_STORAGE_KEY = 'clean_reader_custom_rules';

/** Shape a plugin module must satisfy: a default-exported BookSource instance. */
interface PluginModule {
  default?: BookSource;
  /**
   * Optional module-level flag nominating this source as the application default — the one used
   * when a request carries no `?source=`. Without it the default would be whichever file happens
   * to sort first, so adding a plugin could silently change global behaviour.
   */
  isDefault?: boolean;
}

export class SourceRegistry {
  private sources: Map<string, BookSource> = new Map();
  /** Set by the plugin that exports `isDefault`. Falls back to the first registered source. */
  private explicitDefaultId?: string;

  constructor() {
    this.discoverPlugins();
    this.loadCustomRules();

    // An empty plugins/ directory resolves to an empty context without erroring, which would
    // otherwise surface only as every API route failing at request time.
    if (this.sources.size === 0) {
      console.warn(
        '[SourceRegistry] No book sources registered. Add a plugin to src/sources/plugins/ and rebuild.'
      );
    }
  }

  /**
   * Register every module in ./plugins whose default export is a BookSource.
   *
   * Webpack resolves this context at build time, so dropping a file into the directory is the
   * only step needed to add a source, and deleting it is the only step needed to remove one —
   * there is deliberately no central registration list to keep in sync.
   *
   * A plugin that throws while loading, or that does not default-export a valid source, is
   * skipped with a warning rather than taking down the whole registry.
   */
  private discoverPlugins(): void {
    const context = require.context('./plugins', false, /\.ts$/);
    for (const key of context.keys().sort()) {
      try {
        const mod = context<PluginModule>(key);
        const source = mod?.default;
        if (!source || typeof source !== 'object' || !source.meta?.id) {
          console.warn(
            `[SourceRegistry] Skipping plugin '${key}': default export is not a BookSource with a meta.id`
          );
          continue;
        }
        if (this.sources.has(source.meta.id)) {
          console.warn(
            `[SourceRegistry] Plugin '${key}' re-registers source id '${source.meta.id}'; replacing the earlier one`
          );
        }
        if (mod.isDefault) {
          if (this.explicitDefaultId) {
            console.warn(
              `[SourceRegistry] Both '${this.explicitDefaultId}' and '${source.meta.id}' declare isDefault; keeping '${this.explicitDefaultId}'`
            );
          } else {
            this.explicitDefaultId = source.meta.id;
          }
        }
        this.register(source);
      } catch (err: any) {
        console.warn(`[SourceRegistry] Failed to load plugin '${key}':`, err?.message || err);
      }
    }
  }

  /**
   * The source used when a request carries no `?source=`.
   *
   * Prefers the plugin that exports `isDefault`, so adding or renaming a plugin can't change the
   * default by accident. Falls back to the first registered source, so a registry with no
   * explicit default (or a mislabelled one) still works — and any single plugin can be deleted
   * without breaking the fallback.
   */
  public getDefaultSourceId(): string | undefined {
    if (this.explicitDefaultId && this.sources.has(this.explicitDefaultId)) {
      return this.explicitDefaultId;
    }
    const first = this.sources.keys().next();
    return first.done ? undefined : first.value;
  }

  public register(source: BookSource): void {
    this.sources.set(source.meta.id, source);
  }

  public unregister(id: string): boolean {
    return this.sources.delete(id);
  }

  public getSource(id?: string): BookSource {
    const fallbackId = this.getDefaultSourceId();
    if (!fallbackId) {
      throw new Error('No book sources registered');
    }

    const targetId = id || fallbackId;
    const source = this.sources.get(targetId);
    if (source) {
      return source;
    }

    // Stale links (a source that was removed, or a typo) still resolve, but never silently.
    console.warn(
      `[SourceRegistry] Unknown book source '${targetId}', falling back to '${fallbackId}'`
    );
    const fallback = this.sources.get(fallbackId);
    if (!fallback) {
      throw new Error('No book sources registered');
    }
    return fallback;
  }

  /**
   * Listed with the default source first, so the UI's "first entry" is the same source the server
   * falls back to when a request omits `?source=`.
   */
  public listSources(): SourceMeta[] {
    const defaultId = this.getDefaultSourceId();
    const all = Array.from(this.sources.values());
    all.sort((a, b) =>
      a.meta.id === defaultId ? -1 : b.meta.id === defaultId ? 1 : 0
    );
    return all.map((s) => s.meta);
  }

  public hasSource(id: string): boolean {
    return this.sources.has(id);
  }

  /**
   * Register a custom rule-based book source dynamically.
   * Can persist the rule in browser localStorage.
   */
  public registerCustomRule(
    ruleConfig: RuleBookSourceConfig,
    persist: boolean = true
  ): BookSource {
    if (!ruleConfig.meta?.id || !ruleConfig.meta?.name) {
      throw new Error('Custom rule must provide meta.id and meta.name');
    }

    const source = new RuleBasedSource(ruleConfig);
    this.register(source);

    if (persist && typeof window !== 'undefined') {
      try {
        const stored = this.getCustomRules();
        const existingIdx = stored.findIndex((r) => r.meta.id === ruleConfig.meta.id);
        if (existingIdx >= 0) {
          stored[existingIdx] = ruleConfig;
        } else {
          stored.push(ruleConfig);
        }
        localStorage.setItem(CUSTOM_RULES_STORAGE_KEY, JSON.stringify(stored));
      } catch (err) {
        console.error('Failed to persist custom rule in localStorage:', err);
      }
    }

    return source;
  }

  /**
   * Remove a custom rule from the registry and localStorage.
   */
  public removeCustomRule(id: string): boolean {
    const deleted = this.unregister(id);
    if (typeof window !== 'undefined') {
      try {
        const stored = this.getCustomRules();
        const filtered = stored.filter((r) => r.meta.id !== id);
        localStorage.setItem(CUSTOM_RULES_STORAGE_KEY, JSON.stringify(filtered));
      } catch (err) {
        console.error('Failed to remove custom rule from localStorage:', err);
      }
    }
    return deleted;
  }

  /**
   * Retrieve all saved custom rule configs from storage.
   */
  public getCustomRules(): RuleBookSourceConfig[] {
    if (typeof window === 'undefined') return [];
    try {
      const data = localStorage.getItem(CUSTOM_RULES_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Load and register all custom rules from localStorage into the active registry.
   */
  public loadCustomRules(): void {
    if (typeof window === 'undefined') return;
    try {
      const rules = this.getCustomRules();
      for (const rule of rules) {
        this.register(new RuleBasedSource(rule));
      }
    } catch (err) {
      console.error('Failed to load custom rules from storage:', err);
    }
  }

  /**
   * Export all custom rules as a formatted JSON string.
   */
  public exportCustomRules(): string {
    return JSON.stringify(this.getCustomRules(), null, 2);
  }

  /**
   * Import multiple rules from a JSON string or array.
   */
  public importCustomRules(jsonOrArray: string | RuleBookSourceConfig[]): RuleBookSourceConfig[] {
    const list: RuleBookSourceConfig[] =
      typeof jsonOrArray === 'string' ? JSON.parse(jsonOrArray) : jsonOrArray;

    if (!Array.isArray(list)) {
      throw new Error('Imported data must be an array of rule configs');
    }

    const imported: RuleBookSourceConfig[] = [];
    for (const rule of list) {
      this.registerCustomRule(rule, true);
      imported.push(rule);
    }
    return imported;
  }
}

export const sourceRegistry = new SourceRegistry();

// Export rule engine
export {
  RuleBasedSource,
  type RuleBookSourceConfig,
  type RuleSourceMeta,
  type RuleSearchConfig,
  type RuleDetailConfig,
  type RuleChapterConfig,
} from './rule-engine';

// Export types
export * from './types';
