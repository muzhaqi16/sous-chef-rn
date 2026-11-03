#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ApproximateLocationModule, NSObject)
RCT_EXTERN_METHOD(heldPosition:(double)maxAgeMillis
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(readPosition:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(cancelRead)
@end
