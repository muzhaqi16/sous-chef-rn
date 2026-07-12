//
//  PushNotificationForwarder.m
//  SousChef
//

#import "PushNotificationForwarder.h"
#import <RNCPushNotificationIOS.h>

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
  [RNCPushNotificationIOS didReceiveNotificationResponse:response];
}

@end
