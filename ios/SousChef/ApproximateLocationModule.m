#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ApproximateLocationModule, NSObject)
RCT_EXTERN_METHOD(getCurrentPosition:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
@end
