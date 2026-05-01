package com.hyeyoon.mediamanager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ShareReceiver")
public class ShareReceiverPlugin extends Plugin {

    static String pendingUrl = null;
    private static ShareReceiverPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    // MainActivity에서 호출 - 앱 실행 중 공유 시 JS에 이벤트 전달
    public static void notifyUrl(String url) {
        if (instance != null) {
            JSObject data = new JSObject();
            data.put("url", url);
            instance.notifyListeners("urlReceived", data);
        }
    }

    // Vue에서 앱 시작 시 호출 - 공유로 앱이 열린 경우 URL 반환
    @PluginMethod
    public void getPendingUrl(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("url", pendingUrl != null ? pendingUrl : "");
        pendingUrl = null;
        call.resolve(ret);
    }
}
