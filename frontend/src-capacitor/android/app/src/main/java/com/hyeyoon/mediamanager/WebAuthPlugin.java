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

            String igCookies = cookieManager.getCookie("https://www.instagram.com");
            android.util.Log.d("WebAuthPlugin", "[extract] ig cookies present: " + (igCookies != null && igCookies.contains("sessionid")));

            // 이미지 추출 JS:
            // 1순위: script 태그 JSON의 display_url
            // 2순위: img/source 태그의 src, data-src, srcset
            // 3순위: innerHTML 전체에서 CDN URL 스캔
            final String js =
                "(function() {" +
                "var images=[],seen={};" +
                "function addUrl(u){" +
                "  if(!u)return;" +
                "  u=u.replace(/\\\\u0026/g,'&').replace(/&amp;/g,'&').replace(/\\\\/g,'');" +
                "  if((u.indexOf('cdninstagram')<0&&u.indexOf('fbcdn')<0))return;" +
                "  if(!seen[u]){seen[u]=1;images.push(u);}" +
                "}" +
                // Method 1: display_url in script tags
                "document.querySelectorAll('script').forEach(function(s){" +
                "  var t=s.textContent,re=/\"display_url\":\"(https:[^\"]+)\"/g,m;" +
                "  while((m=re.exec(t))!==null)addUrl(m[1]);" +
                "});" +
                // Method 2: img + source 태그 (src, data-src, srcset)
                "document.querySelectorAll('img,source').forEach(function(el){" +
                "  addUrl(el.src||'');" +
                "  addUrl(el.getAttribute('data-src')||'');" +
                "  addUrl(el.getAttribute('data-lazy-src')||'');" +
                "  (el.srcset||el.getAttribute('data-srcset')||'').split(',').forEach(function(s){addUrl(s.trim().split(' ')[0]);});" +
                "});" +
                // Method 3: innerHTML 전체 스캔 (위 두 방법 실패시)
                "if(images.length===0){" +
                "  var html=document.documentElement.innerHTML;" +
                "  var re3=/https:\\/\\/[a-z0-9\\-]+\\.(?:cdninstagram|fbcdn)\\.net\\/[^\\s\"'<>\\\\]+/g,m3;" +
                "  while((m3=re3.exec(html))!==null){" +
                "    var u3=m3[0].replace(/&amp;/g,'&');" +
                "    if(!seen[u3]){seen[u3]=1;images.push(u3);}" +
                "  }" +
                "}" +
                "var dbg={imgs:document.querySelectorAll('img').length,scripts:document.querySelectorAll('script').length,found:images.length};" +
                "console.log('[extract-js] debug:'+JSON.stringify(dbg));" +
                "return images;" +
                "})()";

            // 20초 timeout
            final Runnable timeoutRunnable = () -> {
                if (!done.compareAndSet(false, true)) return;
                android.util.Log.d("WebAuthPlugin", "[extract] timeout reached");
                JSObject ret = new JSObject();
                try { ret.put("images", new JSONArray()); } catch (Exception ignored) {}
                call.resolve(ret);
                wv.destroy();
            };
            handler.postDelayed(timeoutRunnable, 20000);

            wv.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String pageUrl) {
                    android.util.Log.d("WebAuthPlugin", "[extract] onPageFinished: " + pageUrl);
                    if (pageUrl == null || !pageUrl.contains("instagram.com")) return;
                    // 리다이렉트가 끝나고 실제 인스타그램 페이지에 도달했을 때만 실행
                    if (!done.compareAndSet(false, true)) return;
                    handler.removeCallbacks(timeoutRunnable);

                    // React 앱 렌더링 + 이미지 lazy-load 대기
                    handler.postDelayed(() -> {
                        android.util.Log.d("WebAuthPlugin", "[extract] running JS extraction");
                        view.evaluateJavascript(js, value -> {
                            android.util.Log.d("WebAuthPlugin", "[extract] JS result length: " + (value != null ? value.length() : 0));
                            JSObject ret = new JSObject();
                            try {
                                ret.put("images", new JSONArray(value != null ? value : "[]"));
                            } catch (Exception e) {
                                try { ret.put("images", new JSONArray()); } catch (Exception ignored) {}
                            }
                            call.resolve(ret);
                            view.destroy();
                        });
                    }, 5000);
                }
            });

            wv.loadUrl(url);
        });
    }
}
