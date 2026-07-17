//
//  PushNotificationForwarder.m
//  SousChef
//

#import "PushNotificationForwarder.h"
#import <RNCPushNotificationIOS.h>
#import <React/RCTBridgeModule.h>

// Tap that launched (or preceded) the current JS session. Caching stops
// permanently after the first consume — from then on the live NSNotification
// event path owns tap delivery. Guarded by @synchronized: didReceive runs on
// the main thread, consume on the JS thread.
static NSDictionary *initialTapUserInfo = nil;
static BOOL initialTapConsumed = NO;

@implementation PushNotificationForwarder

+ (void)didRegisterWithDeviceToken:(NSData *)deviceToken {
  [RNCPushNotificationIOS didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
}

+ (void)didFailToRegisterWithError:(NSError *)error {
  [RNCPushNotificationIOS didFailToRegisterForRemoteNotificationsWithError:error];
}

+ (void)didReceiveRemoteNotification:(NSDictionary *)userInfo
              fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler {
  // RNCPushNotificationIOS only invokes this handler after a JS 'notification'
  // listener attaches, and the app registers that listener inside a React
  // effect gated behind storage hydration — a push delivered before then
  // (killed-app content-available launch, launch/hydration window) would leak
  // the handler and trip the ~30s background watchdog. Wrap it as a one-shot
  // (flag confined to the main queue) and complete with NoData from a 20s
  // failsafe if JS never finishes it. JS reports NoData too, so the failsafe
  // never misreports a fetch result.
  __block BOOL completed = NO;
  void (^completeOnce)(UIBackgroundFetchResult) = ^(UIBackgroundFetchResult result) {
    dispatch_async(dispatch_get_main_queue(), ^{
      if (completed) {
        return;
      }
      completed = YES;
      completionHandler(result);
    });
  };

  [RNCPushNotificationIOS didReceiveRemoteNotification:userInfo
                               fetchCompletionHandler:completeOnce];

  dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(20 * NSEC_PER_SEC)),
                 dispatch_get_main_queue(), ^{
                   completeOnce(UIBackgroundFetchResultNoData);
                 });
}

+ (void)didReceiveNotificationResponse:(UNNotificationResponse *)response {
  @synchronized (self) {
    if (!initialTapConsumed) {
      initialTapUserInfo = response.notification.request.content.userInfo;
    }
  }
  [RNCPushNotificationIOS didReceiveNotificationResponse:response];
}

+ (nullable NSDictionary *)consumeInitialNotificationResponse {
  @synchronized (self) {
    initialTapConsumed = YES;
    NSDictionary *cached = initialTapUserInfo;
    initialTapUserInfo = nil;
    return cached;
  }
}

@end

// JS pull for the cached launching tap. Lives in this file so no new source
// needs registering in the Xcode project; RCT_EXPORT_MODULE exposes it as
// NativeModules.InitialNotificationTap.
@interface InitialNotificationTap : NSObject <RCTBridgeModule>
@end

@implementation InitialNotificationTap

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

RCT_EXPORT_METHOD(consume:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSDictionary *userInfo =
      [PushNotificationForwarder consumeInitialNotificationResponse];
  resolve(userInfo ?: (id)kCFNull);
}

@end
