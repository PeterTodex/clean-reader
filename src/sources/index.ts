import { BookSource, SourceMeta } from './types';
import { DiyibanzhuSource } from './diyibanzhu';

class SourceRegistry {
  private sources: Map<string, BookSource> = new Map();
  private defaultSourceId: string = 'diyibanzhu';

  constructor() {
    this.register(new DiyibanzhuSource());
  }

  public register(source: BookSource): void {
    this.sources.set(source.meta.id, source);
  }

  public getSource(id?: string): BookSource {
    const targetId = id || this.defaultSourceId;
    const source = this.sources.get(targetId);
    if (!source) {
      // Fallback to default
      const fallback = this.sources.get(this.defaultSourceId);
      if (!fallback) throw new Error(`Book source '${targetId}' not found and default source missing`);
      return fallback;
    }
    return source;
  }

  public listSources(): SourceMeta[] {
    return Array.from(this.sources.values()).map((s) => s.meta);
  }
}

export const sourceRegistry = new SourceRegistry();
