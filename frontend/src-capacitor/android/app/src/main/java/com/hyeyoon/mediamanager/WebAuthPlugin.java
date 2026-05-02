package com.hyeyoon.mediamanager;

import android.app.Activity;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import androidx.activity.result.ActivityResult;

import org.json.JSONArray;

import java.util.concurrent.atomic.AtomicBoolean;

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

    @PluginMethod
    public void extractInstagramMedia(PluginCall call) {
        String url = call.getString("url");
        if (url == null) {
            call.reject("url is required");
            return;
        }

        call.setKeepAlive(true);

        getActivity().runOnUiThread(() -> {
            final WebView wv = new WebView(getContext());
            final Handler handler = new Handler(Looper.getMainLooper());
            final AtomicBoolean done = new AtomicBoolean(false);

            WebSettings settings = wv.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setUserAgentString(
                "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36"
            );

            // 로그인 시 저장된 instagram.com 쿠키를 이 WebView도 공유
            CookieManager cookieManager = CookieManager.getInstance();
            cookieManager.setAcceptCookie(true);
            cookieManager.setAcceptThirdPartyCookies(wv, true);

            // 1순위: script 태그 JSON에서 display_url 추출 (캐러셀 전체)
            // 2순위: img 태그에서 CDN URL 추출 (fallback)
            final String js =
                "(function() {" +
                "var images=[],seen={};" +
                "document.querySelectorAll('script').forEach(function(s){" +
                "  var t=s.textContent;" +
                "  var re=/\"display_url\":\"(https:[^\"]+)\"/g,m;" +
                "  while((m=re.exec(t))!==null){" +
                "    var u=m[1].replace(/\\\\u0026/g,'&').replace(/\\\\/g,'');" +
                "    if(!seen[u]){seen[u]=1;images.push(u);}" +
                "  }" +
                "});" +
                "if(images.length===0){" +
                "  document.querySelectorAll('img').forEach(function(el){" +
                "    var src=el.src||'';" +
                "    if((src.indexOf('cdninstagram')>=0||src.indexOf('fbcdn')>=0)&&!seen[src])" +
                "      {seen[src]=1;images.push(src);}" +
                "  });" +
                "}" +
                "return images;" +
                "})()";

            // 15초 내에 페이지가 안 열리면 빈 결과 반환
            final Runnable timeoutRunnable = () -> {
                if (!done.compareAndSet(false, true)) return;
                JSObject ret = new JSObject();
                try { ret.put("images", new JSONArray()); } catch (Exception ignored) {}
                call.resolve(ret);
                wv.destroy();
            };
            handler.postDelayed(timeoutRunnable, 15000);

            wv.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String pageUrl) {
                    // 처음 한 번만 실행 (리다이렉트로 여러 번 호출될 수 있음)
                    if (!done.compareAndSet(false, true)) return;
                    handler.removeCallbacks(timeoutRunnable);

                    // React 앱 렌더링 대기 후 JavaScript 실행
                    handler.postDelayed(() -> {
                        view.evaluateJavascript(js, value -> {
                            JSObject ret = new JSObject();
                            try {
                                ret.put("images", new JSONArray(value != null ? value : "[]"));
                            } catch (Exception e) {
                                try { ret.put("images", new JSONArray()); } catch (Exception ignored) {}
                            }
                            call.resolve(ret);
                            view.destroy();
                        });
                    }, 3000);
                }
            });

            wv.loadUrl(url);
        });
    }
}
