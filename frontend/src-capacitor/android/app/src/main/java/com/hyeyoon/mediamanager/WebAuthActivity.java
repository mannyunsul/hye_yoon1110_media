package com.hyeyoon.mediamanager;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
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
        settings.setUserAgentString(
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36"
        );

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebChromeClient(new WebChromeClient());

        final String finalPlatform = platform;
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (url == null) return;

                boolean loginSuccess;
                String cookieDomain;

                if (finalPlatform.equals("instagram")) {
                    boolean onIG = url.contains("instagram.com");
                    boolean onLoginPage = url.contains("accounts/login") ||
                                         url.contains("accounts/signup") ||
                                         url.contains("challenge");
                    loginSuccess = onIG && !onLoginPage;
                    cookieDomain = "https://www.instagram.com";
                } else {
                    boolean onX = url.contains("x.com") || url.contains("twitter.com");
                    boolean onLoginFlow = url.contains("i/flow/");
                    loginSuccess = onX && !onLoginFlow;
                    cookieDomain = "https://x.com";
                }

                if (loginSuccess) {
                    CookieManager.getInstance().flush();
                    String cookies = CookieManager.getInstance().getCookie(cookieDomain);

                    if (finalPlatform.equals("x")) {
                        String twCookies = CookieManager.getInstance().getCookie("https://twitter.com");
                        if (twCookies != null && !twCookies.isEmpty()) {
                            cookies = (cookies != null ? cookies + "; " : "") + twCookies;
                        }
                    }

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
