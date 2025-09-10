declare module 'react-native-config' {
  export interface NativeConfig {
    API_URL: string;
    WEB_SOCKET_URL: string;
    API_KEY: string;
    NODE_ENV?: string;
  }

  export const Config: NativeConfig;
  export default Config;
}
