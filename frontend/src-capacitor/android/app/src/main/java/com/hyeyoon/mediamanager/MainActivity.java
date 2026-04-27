package com.hyeyoon.mediamanager;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WebAuthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
