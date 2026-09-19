/**
 * Minimal type declarations for Node's built-in `node:sqlite` module (Node >= 22.5).
 *
 * The project pins `@types/node@^20`, which predates `node:sqlite`, so the module is declared
 * here by hand. This file has no top-level import/export, so it is a global script and
 * `declare module` below registers an ambient module.
 *
 * If `@types/node` is ever bumped to >= 22, delete this file — the real declarations will
 * supersede it and leaving both in place causes duplicate-identifier errors.
 *
 * Only the surface actually used by `src/lib/chapter-cache.ts` is declared.
 */

declare module 'node:sqlite' {
  interface StatementResultingChanges {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  }

  interface StatementSync {
    run(...anonymousParameters: unknown[]): StatementResultingChanges;
    get(...anonymousParameters: unknown[]): unknown;
    all(...anonymousParameters: unknown[]): unknown[];
    iterate(...anonymousParameters: unknown[]): IterableIterator<unknown>;
  }

  interface DatabaseSyncOptions {
    open?: boolean;
    readOnly?: boolean;
    /** Busy timeout in milliseconds. Defaults to 0, i.e. fail immediately on a locked database. */
    timeout?: number;
    enableForeignKeyConstraints?: boolean;
    enableDoubleQuotedStringLiterals?: boolean;
    allowExtension?: boolean;
  }

  class DatabaseSync {
    constructor(location: string, options?: DatabaseSyncOptions);
    readonly isOpen: boolean;
    readonly isTransaction: boolean;
    open(): void;
    close(): void;
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
