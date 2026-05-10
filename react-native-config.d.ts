declare module 'react-native-config' {
  export interface NativeConfig {
    API_URL: string;
    API_KEY: string;
    WEB_SOCKET_URL: string;
    NODE_ENV?: string;
    WEB_APP_URL?: string;
    SPOONACULAR_API_KEY?: string;
    OTLP_METRICS_ENDPOINT?: string;
    OTLP_METRICS_AUTH_USERNAME?: string;
    OTLP_METRICS_AUTH_PASSWORD?: string;
    OTLP_LOGS_ENDPOINT?: string;
    OTLP_LOGS_AUTH_USERNAME?: string;
    OTLP_LOGS_AUTH_PASSWORD?: string;
    GRAPHQL_BATCH_ENABLED?: string;
  }

  export const Config: NativeConfig;
  export default Config;
}
