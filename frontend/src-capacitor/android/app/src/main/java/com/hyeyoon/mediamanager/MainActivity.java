package com.hyeyoon.mediamanager;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WebAuthPlugin.class);
        registerPlugin(ShareReceiverPlugin.class);
        super.onCreate(savedInstanceState);
        handleShareIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleShareIntent(intent);
    }

    private void handleShareIntent(Intent intent) {
        if (intent == null) return;
        if (!Intent.ACTION_SEND.equals(intent.getAction())) return;
        String type = intent.getType();
        if (!"text/plain".equals(type)) return;

        String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (sharedText == null || sharedText.isEmpty()) return;

        // URL 추출 - 공유 텍스트에서 http로 시작하는 URL 파싱
        String url = extractUrl(sharedText);
        if (url == null) return;

        ShareReceiverPlugin.pendingUrl = url;
        ShareReceiverPlugin.notifyUrl(url);
    }

    private String extractUrl(String text) {
        // 텍스트에서 URL 추출
        String[] words = text.split("\\s+");
        for (String word : words) {
            if (word.startsWith("http://") || word.startsWith("https://")) {
                return word;
            }
        }
        // URL이 없으면 텍스트 전체가 URL일 수 있음
        if (text.trim().startsWith("http")) {
            return text.trim();
        }
        return null;
    }
}
