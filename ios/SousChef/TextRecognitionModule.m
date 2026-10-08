#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(TextRecognitionModule, NSObject)
RCT_EXTERN_METHOD(recognizeAndDelete:(NSArray<NSString *> *)imageUris
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(preparePhotos:(NSArray<NSString *> *)imageUris
                  keepPages:(BOOL)keepPages
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(deletePhotos:(NSArray<NSString *> *)imageUris
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
@end
