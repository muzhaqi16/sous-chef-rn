declare module 'react-native-config' {
  export interface NativeConfig {
    API_URL?: string;
    GOOGLE_MAPS_API_KEY?: string;
  }

  export const Config: NativeConfig;
  export default Config;
}
