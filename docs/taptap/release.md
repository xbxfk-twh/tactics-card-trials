# TapTap 发布候选版

目标应用：炫冰的工作室 / 战棋试炼，Developer ID `455373`，App ID `945715`。核验日期：2026-10-31。源代码仍只有 `apps/web` 一份，Android 和 TapTap H5 分别包装该运行清单，不恢复旧 Canvas 原型。

## 生成与验证

在 `apps/web` 内运行：

```sh
npm ci
npm test
npm run build:taptap
npm run test:taptap
node tests/browser-smoke.cjs --mobile --capture --store
```

上传候选目录：根目录 `dist/taptap-h5/`，入口 `index.html`。
候选 ZIP：`dist/tactics-0.8.13-taptap-h5.zip`。
哈希和文件清单：`dist/taptap-h5-report.json`。
导出的浏览器截图：`artifacts/screenshots/store/`。这些是实际渲染的测试状态，不能标注为 Android / TapTap 真机截图。

普通网页和 Android 包不会加载 H5 专用授权入口。H5 包使用 `js/network/tap-host-entry.js` 和 `css/tap-host.css` 替换启动入口；其余运行资源沿用现行清单。候选包不携带服务器、测试代码、播放器数据、密钥、广告占位代码或原稿。

## 账号与联机边界

- TapTap 宿主提供 `window.tap`，不注入未经核验的远程 SDK。平台接口缺失时提示从 H5 测试入口打开；授权取消、空返回、超时和加载失败允许重试。
- 临时登录 code 不落盘、不记录日志、不发送到当前访客房间服务器。此步骤仅取得宿主授权；未实现 code2Session、自有 TapTap 账号、云存档或账号合并，不能宣传这些能力。
- H5 默认仍使用 `wss://guyuyizhang.top/tactics/ws`，与普通网页、Android 包共享服务端裁定的房间。显式保存的服务器地址仍优先。
- 即使宿主暴露 TapTap 房间 API，也不自动改用另一套房间。已有的 Tap 房间适配器保留为受测试的源码能力，不是本候选包的默认传输。
- 战役进度、访客身份和设置仍按设备及网页来源保存。切换平台不会自动继承其他来源的进度或段位。

## 当前平台事实与发布边界

当前应用列表返回：`945715` 是未发布的非关卡游戏，分类 strategy。状态查询接口明确拒绝：该应用不符合“关卡或已通过备案的 H5 游戏”条件。这个响应不能单独证明具体哪项资质缺失，也不能把 API 失败解释成审核已通过。

本次 `prepare_h5_upload` 还返回了工作目录错误：工具把相对路径解析在另一个项目《孤屿遗章》下，而当前项目位于 `E:\灵灰工作区\01_项目\战棋-diy卡牌测试版`。`check_environment` 已确认当前工具的 `WORKSPACE_ROOT` 是旧项目。应先将上传工具的 `WORKSPACE_ROOT` 绑定到当前仓库并重新加载工具，再对 `dist/taptap-h5` 重新预检；不能上传另一个项目、混用应用或用旧项目目录伪装本包。此次未上传游戏包。图片和资料草稿通过已登录后台处理。

已进一步直接核对开发者后台：开发者认证已过审；当前草稿 `V-20260924` 的分发类型为 Android / iOS / Windows，均为“敬请期待”，没有确认启用的 H5 游玩类型。不能将本机的 H5 候选包当成这个草稿已经可玩的证明。

后台仍显示隐私政策、防沉迷合规、AI 接入声明和适龄分级待上传。图文“必填完成度”与这些正式游玩资质分别计算，不能混为一谈。相应的技术事实和声明候选见 [隐私数据清单](privacy-facts.md) 与 [AI 辅助内容说明](ai-disclosure-draft.md)，不是已通过的合规材料。

广告状态返回“未开通”，用户选择暂缓。此次候选包不接广告，不自动复查或复用其他应用的广告位。

H5 候选包的宿主授权和共享服务端选择已有模拟 SDK 浏览器回归；这不等于已完成 TapTap 真机扫码测试、外网 WSS 白名单验证或正式审核。

发布前需在本应用后台核实产品形态和 H5 开通/资质入口，再上传候选包进行平台自测。若当前应用不具备 H5 上传入口，不应将此 DOM 网页包冒充普通 Canvas/WebGL 小游戏或改绑其他应用。

建议先以“小范围试玩候选”验收，不同时承诺 APK 渠道与小游戏的账号/存档互通。当前 APK 也没有真机安装验收记录。

商店页预约和正式可玩包分别遵循平台流程；本次准备不等于已提交或发布：

- [H5 MCP 适用范围与上传](https://developer.taptap.cn/minigameapidoc/quick-start/mcp-guide/mcp-setup/)
- [小游戏种类](https://developer.taptap.cn/minigameapidoc/quick-start/guide/minigames-intro/)
- [游戏页状态、正式发布与包体自测](https://developer.taptap.cn/minigameapidoc/quick-start/guide/creation-improvement/)
- [前置备案适用范围](https://developer.taptap.cn/minigameapidoc/quick-start/guide/pre-filing/)
- [账号与登录态](https://developer.taptap.cn/minigameapidoc/dev/tutorial/open-capabilities/login-management/)

游戏页材料见 [商店文案](store-copy.md)，后续广告方案见 [广告设计](ads-plan.md)。

## 本地商店素材

`artifacts/taptap-release/media/` 保存横版封面、竖版封面、图标、透明 Logo、无文字的 3840×1240 游戏库背景、方形宣传图和四张竖屏游戏截图。封面/图标使用 imagegen 按本游戏角色重新绘制，再导出平台要求尺寸；宣传图和封面只保留游戏标题，去除额外标语。横/竖游戏封面按后台目标比例裁切并检查标题、角色安全区域。

截图来自 390×844 CSS 视口、2 倍像素比的真实浏览器渲染，输出 780×1688，不是实体手机截图。原画留在 `artifacts/source-art/taptap/`，不装进游戏包。录像仍需在实际 TapTap 宿主设备上采集，不能用概念插画或模拟器录像冒充。

已在本应用后台草稿保存游戏简介、首页推荐语、开发者的话，以及新图标、宣传图、四张截图和对应展示素材；未更改既有分发状态，未提交审核。专用图片接口缺少可用签名能力、资料更新接口拒绝非关卡应用，因此使用已登录后台完成图文准备；未索要或复制平台客户端密钥。
