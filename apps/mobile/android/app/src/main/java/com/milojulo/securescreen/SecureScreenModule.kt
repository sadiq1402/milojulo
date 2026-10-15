package com.milojulo.securescreen

import android.view.WindowManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

// Sets FLAG_SECURE on the activity window so chat screens can't be captured (screenshots,
// screen recording, the recents thumbnail).
class SecureScreenModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "SecureScreen"

  @ReactMethod
  fun setSecure(secure: Boolean) {
    val activity = reactApplicationContext.currentActivity ?: return
    activity.runOnUiThread {
      if (secure) {
        activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
      } else {
        activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
      }
    }
  }
}
