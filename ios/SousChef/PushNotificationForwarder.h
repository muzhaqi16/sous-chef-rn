//
//  PushNotificationForwarder.h
//  SousChef
//
//  Thin Objective-C bridge from the Swift AppDelegate's remote-notification
//  callbacks to RNCPushNotificationIOS (@react-native-community/push-notification-ios).
//  Keeping the pod call sites in Objective-C keeps the exact Objective-C
//  selectors intact; the NS_SWIFT_NAME annotations pin the names the Swift
//  AppDelegate uses, so no Swift name is inferred from the pod's headers.
//

#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <UserNotifications/UserNotifications.h>

NS_ASSUME_NONNULL_BEGIN

@interface PushNotificationForwarder : NSObject

/// APNs device token acquired — feeds the library's `register` event so JS can
/// send the token to the backend via registerDevice.
+ (void)didRegisterWithDeviceToken:(NSData *)deviceToken
    NS_SWIFT_NAME(didRegister(deviceToken:));

/// APNs registration failed — feeds the library's `registrationError` event.
+ (void)didFailToRegisterWithError:(NSError *)error
    NS_SWIFT_NAME(didFailToRegister(error:));

/// Remote notification delivered — feeds the library's `notification` event.
/// The completion handler must be invoked after the library finishes.
+ (void)didReceiveRemoteNotification:(NSDictionary *)userInfo
              fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler
    NS_SWIFT_NAME(didReceiveRemoteNotification(_:fetchCompletionHandler:));

/// User tapped a notification — feeds the library's tap/response handling.
+ (void)didReceiveNotificationResponse:(UNNotificationResponse *)response
    NS_SWIFT_NAME(didReceive(response:));

@end

NS_ASSUME_NONNULL_END
