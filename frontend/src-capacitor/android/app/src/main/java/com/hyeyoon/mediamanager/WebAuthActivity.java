package com.hyeyoon.mediamanager;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;

public class WebAuthActivity extends AppCompatActivity {

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        String platform = getIntent().getStringExtra("platform");
        if (platform == null) {
            setResult(Activity.RESULT_CANCELED);
            finish();
            return;
        }

        String loginUrl;
        if (platform.equals("instagram")) {
            loginUrl = "https://www.instagram.com/accounts/login/";
        } else {
            loginUrl = "https://x.com/i/flow/login";
        }

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setDatabaseEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        // 네이티브 앱처럼 보이는 최신 Chrome 사용자 에이전트
        settings.setUserAgentString(
            "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36"
        );

        // 기존 쿠키 초기화 후 시작
        CookieManager.getInstance().removeAllCookies(null);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebChromeClient(new WebChromeClient());

        final String finalPlatform = platform;
        webView.setWebViewClient(new WebViewClient() {

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                // 앱 딥링크 차단 - 네이티브 앱 열기 시도를 무시하고 웹에 머무름
                if (url.startsWith("intent://") ||
                    url.startsWith("instagram://") ||
                    url.startsWith("twitter://") ||
                    url.startsWith("x://")) {
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (url == null) return;

                CookieManager.getInstance().flush();

                boolean loginSuccess = false;
                String cookieDomain;

                if (finalPlatform.equals("instagram")) {
                    cookieDomain = "https://www.instagram.com";
                    String cookies = CookieManager.getInstance().getCookie(cookieDomain);
                    // sessionid 쿠키 존재 = 로그인 성공
                    boolean hasSession = cookies != null && cookies.contains("sessionid=");
                    boolean notOnLoginPage = !url.contains("accounts/login") &&
                                            !url.contains("accounts/signup") &&
                                            !url.contains("challenge");
                    loginSuccess = hasSession && notOnLoginPage;
                } else {
                    cookieDomain = "https://x.com";
                    String cookies = CookieManager.getInstance().getCookie(cookieDomain);
                    // auth_token 쿠키 존재 = 로그인 성공
                    boolean hasAuth = cookies != null && cookies.contains("auth_token=");
                    boolean notOnLoginFlow = !url.contains("i/flow/");
                    loginSuccess = hasAuth && notOnLoginFlow;

                    if (loginSuccess) {
                        String twCookies = CookieManager.getInstance().getCookie("https://twitter.com");
                        if (twCookies != null && !twCookies.isEmpty()) {
                            cookies = cookies + "; " + twCookies;
                        }
                    }
                }

                if (loginSuccess) {
                    String cookies = CookieManager.getInstance().getCookie(
                        finalPlatform.equals("instagram") ? "https://www.instagram.com" : "https://x.com"
                    );
                    Intent result = new Intent();
                    result.putExtra("cookies", cookies != null ? cookies : "");
                    setResult(Activity.RESULT_OK, result);
                    finish();
                }
            }
        });

        webView.loadUrl(loginUrl);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            setResult(Activity.RESULT_CANCELED);
            super.onBackPressed();
        }
    }
}
