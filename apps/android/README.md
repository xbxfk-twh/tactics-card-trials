# 安卓安装版 · 0.8.13

轻量原生 Android WebView 容器，完整内置 H5 运行清单中的游戏和美术；战役、人机练习离线可用。联机默认使用 `wss://guyuyizhang.top/tactics/ws`，与电脑/手机浏览器共享房间、卡池与战斗规则。

[下载已签名 APK](https://guyuyizhang.top/tactics/download/tactics-0.8.13-android.apk)，约 4.4 MB。手机和电脑选择同一服务器，由一方建房，另一方从列表或房间码加入，来客准备、房主开始即可。

最低 Android 8.0，系统 Android WebView 需支持现代 JavaScript。APK 不包含 CPU 原生库，可用于 ARM、ARM64 与 x86 设备。只声明联网权限，无相册、联系人、定位权限。

本机存档和设备访客凭据保存在 App 私有 WebView 数据中，与浏览器分开；不宣称跨端账号、段位或战役存档已互通。卸载/清除应用数据会移除本机进度。联网后台对局仍遵循服务器 45 秒重连窗口。

## 构建

需要 JDK、Python/Pillow、Node.js、官方 Android Platform 35 与 Build Tools 35.0.0。

```powershell
python build.py --sdk "$env:LOCALAPPDATA\TacticsBuild\android-sdk"
```

SDK 官方来源 `https://dl.google.com/android/repository/repository2-3.xml`。本次使用：

- `platform-35_r02.zip`，SHA-1 `0bb560a90a7a2cbd0dd8348224d518b638fe7949`。
- `build-tools_r35_windows.zip`，SHA-1 `af059bb67cf7786f45ee0db85e2d24985df1b4b6`。

下载包校验通过后解压到 SDK 的 `platforms/android-35`、`build-tools/35.0.0`，构建脚本能识别解压包的内层目录。工具缓存放在 LOCALAPPDATA，不进入项目。

签名文件自动在 `%LOCALAPPDATA%/TacticsBuild/signing` 生成，密码不进入命令文本、源码或发布包；后续覆盖升级必须使用同一把签名钥匙，请单独备份该目录。构建不会上传签名私钥。

产物：`../../dist/tactics-0.8.13-android.apk` 与校验报告 JSON。构建验证签名、ZIP 对齐，以及 APK 内全部 108 个游戏文件与 H5 源码逐字节一致；真机测试情况单列于报告，不以浏览器测试代替真机安装测试。

## 容器边界

使用 HTTPS URL 加载内置白名单资源，保留同源规则；仅清单内的精确路径从 App assets 返回，API/WebSocket 走真实服务器。禁用 file/content 访问、明文 HTTP、混合内容及原生 JavaScript 桥。保留默认 TLS 错误拒绝行为。界面避开系统状态栏、导航栏、刘海和键盘；支持横竖屏切换及返回键关闭弹窗。

参考官方文档：[本地网页内容](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)、[APK 签名验证](https://developer.android.com/tools/apksigner)。


内置资源和联机统一使用 `https://guyuyizhang.top` 的标准 443 端口；不再携带旧网址存档迁移流程。由旧测试版升级时，旧 8443 origin 的本机进度不迁移。未做真机安装测试。
