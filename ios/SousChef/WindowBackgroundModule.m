#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WindowBackgroundModule, NSObject)
RCT_EXTERN_METHOD(setBackgroundColor:(NSString *)hex)
@end
