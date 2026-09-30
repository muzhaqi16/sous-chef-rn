#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(TextRecognitionModule, NSObject)
RCT_EXTERN_METHOD(recognizeAndDelete:(NSArray<NSString *> *)imageUris
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
@end
