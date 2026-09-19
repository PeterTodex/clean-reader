/**
 * Type declarations for webpack's `require.context()`, which Next.js exposes at build time.
 *
 * The project has no `@types/webpack-env` dependency, so the two declarations below are merged
 * into the ambient scope instead. `@types/node` types the global `require` as `NodeJS.Require`
 * (the global `NodeRequire` alias is deprecated and unrelated), so the `context` method is
 * augmented onto that interface. This file must stay free of top-level imports/exports —
 * adding one would turn it into a module and break the global merge.
 *
 * Note: `require.context` is a webpack-only API. It does not work under Turbopack
 * (`next dev --turbo`, or a future Next.js version that defaults to Turbopack).
 */

interface WebpackRequireContext {
  /** Module paths matched by the context, e.g. `./diyibanzhu.ts`. */
  keys(): string[];
  /** The context module's own id. */
  id: string;
  /** Resolve a request to a module id. */
  resolve(id: string): string;
  /** Synchronously load the module at `id`. */
  <T = unknown>(id: string): T;
}

declare namespace NodeJS {
  interface Require {
    context(
      directory: string,
      useSubdirectories?: boolean,
      regExp?: RegExp,
      mode?: 'sync' | 'eager' | 'weak' | 'lazy' | 'lazy-once'
    ): WebpackRequireContext;
  }
}
