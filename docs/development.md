# 开发与验证

在 `apps/web` 运行 `npm ci`、`npm test` 与 `npm run build`。Node版本见根目录 `.nvmrc`，依赖由应用锁文件固定。

根目录 `node scripts/audit-public.cjs` 审计Git暂存/已跟踪文件：公开范围、异常大文件和常见凭据特征。它不读取被忽略的私有资料。

## 浏览器验证

需要Chrome。Windows默认使用标准安装路径；其他平台设置 `CHROME_PATH`。测试使用独立无头浏览器资料目录和本地服务器，不操作日常浏览器。

```sh
cd apps/web
node tests/browser-smoke.cjs --mobile --capture
node tests/party-opening-browser.cjs
node tests/compact-ui-browser.cjs
node tests/vfx-browser.cjs
```

截图在根目录 `artifacts/screenshots/`，平衡报告在 `artifacts/balance/`。固定策略对战不代表真人胜率，浏览器模拟不等于Android真机安装测试。

`public-room-smoke.cjs` 会创建真实公网访客和休闲房间，只能显式手动使用。`public-release.cjs` 校验本项目既有公开站点及 `dist/` 中对应安装包，也不放入普通CI。

## 构建

- Web的 `npm run build` 输出根目录 `dist/`：离线ZIP、服务ZIP和清单。
- `python apps/android/build.py` 输出同一目录：签名APK和验证报告。
- SDK与签名材料放在用户工具缓存或显式指定目录，不进入Git。
- 可选素材再生成依赖见 `requirements-build.txt`；生成MP3另需本机FFmpeg。
- Kenney官方ZIP输入位于 `artifacts/source-assets/kenney-particles/official-particle-pack.zip`，来源与许可见根目录第三方说明。
- TapTap H5 候选包使用 `npm run build:taptap`，模拟宿主回归使用 `npm run test:taptap`；与默认 Web/Android 包分开，见 [TapTap 发布准备](taptap/release.md)。

公开树只维护当前Web和Android版本。旧平台原型不随仓库维护，Web中的平台适配器由模拟SDK测试覆盖。
