// Contract used by the optional Worker cache in dashboard-data.ts.
// GitHub Pages builds replace this import; FPL uses only its shared profile types.
declare module 'cloudflare:workers' {
  export const env: {
    DB?: {
      prepare(query: string): {
        bind(...values: unknown[]): {
          first<T>(): Promise<T | null>;
          run(): Promise<unknown>;
        };
      };
    };
  };
}
