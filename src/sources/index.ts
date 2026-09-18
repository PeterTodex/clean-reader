import { BookSource, SourceMeta } from './types';
import { DiyibanzhuSource } from './diyibanzhu';
import { BiqugeSource, BIQUGE_CONFIG } from './biquge';
import {
  RuleBasedSource,
  RuleBookSourceConfig,
  RuleSourceMeta,
  RuleSearchConfig,
  RuleDetailConfig,
  RuleChapterConfig,
} from './rule-engine';

const CUSTOM_RULES_STORAGE_KEY = 'clean_reader_custom_rules';

export class SourceRegistry {
  private sources: Map<string, BookSource> = new Map();
  private defaultSourceId: string = 'diyibanzhu';

  constructor() {
    this.register(new DiyibanzhuSource());
    this.register(new BiqugeSource());
    this.loadCustomRules();
  }

  public register(source: BookSource): void {
    this.sources.set(source.meta.id, source);
  }

  public unregister(id: string): boolean {
    return this.sources.delete(id);
  }

  public getSource(id?: string): BookSource {
    const targetId = id || this.defaultSourceId;
    const source = this.sources.get(targetId);
    if (!source) {
      // Fallback to default
      const fallback = this.sources.get(this.defaultSourceId);
      if (!fallback) {
        throw new Error(`Book source '${targetId}' not found and default source missing`);
      }
      return fallback;
    }
    return source;
  }

  public listSources(): SourceMeta[] {
    return Array.from(this.sources.values()).map((s) => s.meta);
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

// Export sources
export { DiyibanzhuSource } from './diyibanzhu';
export { BiqugeSource, BIQUGE_CONFIG } from './biquge';
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
