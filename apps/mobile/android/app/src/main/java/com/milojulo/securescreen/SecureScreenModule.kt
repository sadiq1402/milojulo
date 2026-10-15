package com.milojulo.securescreen

import android.view.WindowManager
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

// Sets FLAG_SECURE on the activity window so chat screens can't be captured (screenshots,
// screen recording, the recents thumbnail). The wanted state is kept and applied again on every
// resume, so a change made while there is no activity is never lost.
class SecureScreenModule(context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context), LifecycleEventListener {
  private var secure = false

  init {
    context.addLifecycleEventListener(this)
  }

  override fun getName() = "SecureScreen"

  @ReactMethod
  fun setSecure(secure: Boolean) {
    this.secure = secure
    apply()
  }

  private fun apply() {
    val activity = reactApplicationContext.currentActivity ?: return
    val wanted = secure
    activity.runOnUiThread {
      if (wanted) {
        activity.window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
      } else {
        activity.window.clearFlags(WindowManager.LayoutParams.FLAG_SECURE)
      }
    }
  }

  override fun onHostResume() = apply()

  override fun onHostPause() {}

  override fun onHostDestroy() {}
}
