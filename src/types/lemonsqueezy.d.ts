export {};

declare global {
  interface Window {
    LemonSqueezy?: {
      Url: {
        Open: (url: string) => void;
      };
      Refresh: () => void;
    };
    createLemonSqueezy?: () => void;
  }
}
