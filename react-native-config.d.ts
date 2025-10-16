declare module 'react-native-config' {
  export interface NativeConfig {
    API_URL: string;
    API_KEY: string;
    WEB_SOCKET_URL: string;
    NODE_ENV?: string;
    WEB_APP_URL?: string;
    PROMETHEUS_ENDPOINT?: string;
    SPOONACULAR_API_KEY?: string;
    LOKI_ENDPOINT?: string;
    TELEMETRY_AUTH_USERNAME?: string;
    TELEMETRY_AUTH_PASSWORD?: string;
  }

  export const Config: NativeConfig;
  export default Config;
}
