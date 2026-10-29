package dev.souschef.app

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.play.core.review.ReviewManagerFactory
import com.google.android.play.core.review.testing.FakeReviewManager

/**
 * Google Play's in-app review. Play decides whether its sheet appears and says
 * nothing either way, so a failed request is dropped, as Play's guidance says.
 * A debug build is not installed from Play, so it runs Play's fake manager.
 */
class ReviewPromptModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  @ReactMethod
  fun requestReview() {
    val activity = reactApplicationContext.currentActivity ?: return
    val manager =
      if (BuildConfig.DEBUG) FakeReviewManager(activity)
      else ReviewManagerFactory.create(activity)
    manager.requestReviewFlow().addOnCompleteListener { request ->
      if (request.isSuccessful) manager.launchReviewFlow(activity, request.result)
    }
  }

  companion object {
    const val NAME = "ReviewPromptModule"
  }
}
