package top.guyuyizhang.tactics;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/** Bundled game content on its HTTPS origin; real WSS shares the desktop server. */
public final class MainActivity extends Activity {
    static final String HOST = "guyuyizhang.top";
    static final String PREFIX = "/tactics/";
    static final String HOME = "https://" + HOST + PREFIX;
    private WebView web;
    private Set<String> bundledFiles;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        try {
            Set<String> files = new HashSet<>();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(getAssets().open("game-files.txt"), "UTF-8"))) {
                String line;
                while ((line = reader.readLine()) != null) files.add(line);
            }
            bundledFiles = Collections.unmodifiableSet(files);
        } catch (IOException error) {
            TextView message = new TextView(this);
            message.setText("游戏资源读取失败，请重新安装完整安装包。");
            message.setPadding(32, 64, 32, 32);
            setContentView(message);
            return;
        }
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(237, 243, 235));
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(247, 243, 234));
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        // Keep the viewport inside status/navigation bars and the on-screen keyboard.
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            int left, top, right, bottom;
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                left = safe.left; top = safe.top; right = safe.right; bottom = safe.bottom;
            } else {
                left = insets.getSystemWindowInsetLeft(); top = insets.getSystemWindowInsetTop();
                right = insets.getSystemWindowInsetRight(); bottom = insets.getSystemWindowInsetBottom();
            }
            FrameLayout.LayoutParams layout = (FrameLayout.LayoutParams) web.getLayoutParams();
            layout.setMargins(left, top, right, bottom);
            web.setLayoutParams(layout);
            return insets;
        });
        root.requestApplyInsets();
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setTextZoom(100);
        settings.setBuiltInZoomControls(false);
        settings.setUserAgentString(settings.getUserAgentString() + " TacticsAndroid/0.8.13");
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebViewClient(new GameClient());
        web.loadUrl(HOME);
    }

    private static boolean ownOrigin(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()) && (uri.getPort() == -1 || uri.getPort() == 443);
    }

    private final class GameClient extends WebViewClient {
        @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (!ownOrigin(uri) || !"GET".equals(request.getMethod())) return null;
            String path = uri.getPath();
            if (path == null || !path.startsWith(PREFIX)) return null;
            String relative = path.substring(PREFIX.length());
            if (relative.isEmpty()) relative = "index.html";
            // Only exact inventory entries are served: no filesystem paths or arbitrary traversal.
            if (!bundledFiles.contains(relative)) return null;
            Map<String, String> headers = new HashMap<>();
            headers.put("Cache-Control", "no-cache");
            headers.put("X-Content-Type-Options", "nosniff");
            headers.put("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' wss: https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
            try {
                return new WebResourceResponse(mime(relative), "UTF-8", 200, "OK", headers, getAssets().open("game/" + relative));
            } catch (IOException error) {
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", headers, new ByteArrayInputStream(new byte[0]));
            }
        }
        @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (ownOrigin(uri) && (PREFIX.equals(uri.getPath()) || (PREFIX + "index.html").equals(uri.getPath()))) return false;
            if ("https".equals(uri.getScheme()) && request.isForMainFrame()) {
                try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (android.content.ActivityNotFoundException ignored) { }
            }
            return true;
        }
    }

    private static String mime(String file) {
        if (file.endsWith(".html")) return "text/html";
        if (file.endsWith(".js")) return "text/javascript";
        if (file.endsWith(".css")) return "text/css";
        if (file.endsWith(".webp")) return "image/webp";
        if (file.endsWith(".png")) return "image/png";
        if (file.endsWith(".svg")) return "image/svg+xml";
        if (file.endsWith(".mp3")) return "audio/mpeg";
        return "application/octet-stream";
    }

    @Override public void onBackPressed() {
        if (web == null) { finish(); return; }
        web.evaluateJavascript("(function(){var selectors=['info-close','state-close','stack-cancel','target-cancel','camp-close','match-resume'];for(var i=0;i<selectors.length;i++){var close=document.querySelector('[data-action='+selectors[i]+']');if(close){close.click();return true;}}var match=document.querySelector('nav [data-action=match-menu]');if(match){match.click();return true;}var home=document.querySelector('nav [data-action=home]');if(home&&!home.classList.contains('active')){home.click();return true;}return false;})()", handled -> {
            if (!"true".equals(handled)) new AlertDialog.Builder(this).setTitle("退出游戏？").setNegativeButton("继续玩", null).setPositiveButton("退出", (dialog, which) -> finish()).show();
        });
    }
    @Override public void onPause() { if (web != null) web.onPause(); super.onPause(); }
    @Override public void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override public void onDestroy() {
        if (web != null) { ((FrameLayout) web.getParent()).removeView(web); web.destroy(); web = null; }
        super.onDestroy();
    }
}
