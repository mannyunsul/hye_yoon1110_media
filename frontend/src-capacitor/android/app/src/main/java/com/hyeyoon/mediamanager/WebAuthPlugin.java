package com.hyeyoon.mediamanager;

import android.app.Activity;
import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import androidx.activity.result.ActivityResult;

@CapacitorPlugin(name = "WebAuth")
public class WebAuthPlugin extends Plugin {

    @PluginMethod
    public void login(PluginCall call) {
        String platform = call.getString("platform");
        if (platform == null) {
            call.reject("platform is required");
            return;
        }
        if (!platform.equals("instagram") && !platform.equals("x")) {
            call.reject("unsupported platform: " + platform);
            return;
        }

        Intent intent = new Intent(getContext(), WebAuthActivity.class);
        intent.putExtra("platform", platform);
        startActivityForResult(call, intent, "loginResult");
    }

    @ActivityCallback
    private void loginResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            String cookies = result.getData().getStringExtra("cookies");
            JSObject ret = new JSObject();
            ret.put("cookies", cookies != null ? cookies : "");
            call.resolve(ret);
        } else {
            call.reject("로그인이 취소되었습니다.");
        }
    }
}
