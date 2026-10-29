# 开发与提交

1. 从 `main` 新建 `feat/功能名`、`fix/问题名` 或 `docs/说明名` 分支。
2. 在 `apps/web` 执行 `npm ci`；修改后运行 `npm test` 和 `npm run build`。
3. 界面改动运行相关浏览器测试，检查手机与桌面。生成截图保存在根目录 `artifacts/`。
4. 根目录运行 `node scripts/audit-public.cjs`，检查暂存文件中没有凭据、玩家数据或构建产物。
5. 提交主题写明最终改动，例如 `feat(campaign): smooth opening difficulty`；一个提交解决一件事。
6. PR 写清问题、最终行为和实际验证；不要声称模拟测试等同于真机测试。

合并代码不会自动重启生产服务器。发布前确认没有活动房间并保留回退方案，见 [部署说明](docs/deployment.md)。

仓库目前保留项目自身代码和美术的权利；公开展示不等于采用 MIT 等开源许可。请阅读 [LICENSE](LICENSE) 和 [第三方说明](THIRD_PARTY_NOTICES.md)。
