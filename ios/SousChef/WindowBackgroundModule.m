#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WindowBackgroundModule, NSObject)
RCT_EXTERN_METHOD(setTheme:(NSString *)theme)
RCT_EXTERN_METHOD(setBackgroundColor:(NSString *)hex)
RCT_EXTERN_METHOD(setThemeAndBackground:(NSString *)theme hex:(NSString *)hex)
@end
