#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(ReceiptStructuringModule, NSObject)
RCT_EXTERN_METHOD(availability:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(labelLines:(NSArray<NSString *> *)lines
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
@end
