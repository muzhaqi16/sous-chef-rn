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
  [RNCPushNotificationIOS didReceiveRemoteNotification:userInfo
                               fetchCompletionHandler:completionHandler];
}

+ (void)didReceiveNotificationResponse:(UNNotificationResponse *)response {
  [RNCPushNotificationIOS didReceiveNotificationResponse:response];
}

@end
