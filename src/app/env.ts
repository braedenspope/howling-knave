declare global {
  interface Window {
    __env: {
      supabaseUrl: string;
      supabaseAnonKey: string;
    };
  }
}

export const environment = {
  get supabaseUrl(): string {
    return window.__env?.supabaseUrl ?? '';
  },
  get supabaseAnonKey(): string {
    return window.__env?.supabaseAnonKey ?? '';
  }
};
