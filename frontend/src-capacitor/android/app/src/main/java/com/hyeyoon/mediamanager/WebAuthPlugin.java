package com.hyeyoon.mediamanager;

import android.app.Dialog;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WebAuth")
public class WebAuthPlugin extends Plugin {

    @PluginMethod
    public void login(PluginCall call) {
        String platform = call.getString("platform");
        if (platform == null) {
            call.reject("platform is required");
            return;
        }

        String loginUrl;
        switch (platform) {
            case "instagram":
                loginUrl = "https://www.instagram.com/accounts/login/";
                break;
            case "x":
                loginUrl = "https://x.com/i/flow/login";
                break;
            default:
                call.reject("unsupported platform: " + platform);
                return;
        }

        final String finalPlatform = platform;

        getActivity().runOnUiThread(() -> {
            Dialog dialog = new Dialog(getActivity(), android.R.style.Theme_Black_NoTitleBar_Fullscreen);
            dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

            WebView webView = new WebView(getActivity());
            webView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            ));

            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setLoadWithOverviewMode(true);
            settings.setUseWideViewPort(true);
            settings.setUserAgentString(
                "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36"
            );

            CookieManager.getInstance().setAcceptCookie(true);
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

            webView.setWebViewClient(new WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    super.onPageFinished(view, url);
                    if (url == null) return;

                    boolean loginSuccess = false;
                    String cookieDomain;

                    if (finalPlatform.equals("instagram")) {
                        loginSuccess = url.contains("instagram.com") &&
                                      !url.contains("accounts/login") &&
                                      !url.contains("accounts/signup") &&
                                      !url.contains("challenge");
                        cookieDomain = "https://www.instagram.com";
                    } else {
                        loginSuccess = url.contains("x.com/home") ||
                                      url.contains("twitter.com/home");
                        cookieDomain = "https://x.com";
                    }

                    if (loginSuccess) {
                        CookieManager.getInstance().flush();
                        String cookies = CookieManager.getInstance().getCookie(cookieDomain);
                        dialog.dismiss();

                        JSObject result = new JSObject();
                        result.put("cookies", cookies != null ? cookies : "");
                        call.resolve(result);
                    }
                }
            });

            dialog.setOnDismissListener(d -> {
                if (!call.isResolved()) {
                    call.reject("로그인이 취소되었습니다.");
                }
            });

            dialog.setContentView(webView);

            Window window = dialog.getWindow();
            if (window != null) {
                window.setLayout(
                    WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.MATCH_PARENT
                );
            }

            dialog.show();
            webView.loadUrl(loginUrl);
        });
    }
}
