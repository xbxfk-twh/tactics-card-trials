# 部署

生产服务与GitHub源码发布独立；CI不持有服务器凭据，也不自动重启线上服务。

1. 在 `apps/web` 执行 `npm ci` 和 `npm run build`。
2. 将根目录 `dist/` 的联机服务ZIP上传到自己的服务器，解压到独立发布目录。包内相对路径不依赖仓库层级。
3. 安装Node.js，使用普通服务账户，仅监听本机端口；`TACTICS_DATA_FILE` 指向发布目录外的持久文件。
4. 参考包内 `server/tactics.service.example` 和 `server/tactics-location.conf.example` 配置systemd与Nginx，保留WSS升级头和有效证书。
5. 发布前确认没有活动房间，保留旧目录与配置，原子切换发布链接；健康检查失败时恢复。
6. 本机健康检查通过后验证公网HTTPS/WSS、建房、准备、回合权限和重连。

这是单实例JSON持久化服务，不能让多个进程同时写同一玩家文件。重启清空房间，已结算段位保留。私有数据不得由静态路由暴露。

源目录直接运行示例（POSIX shell，在 `apps/web` 内）：

```sh
HOST=127.0.0.1 PORT=8088 TACTICS_DATA_FILE=/var/lib/tactics/players.json node server/server.cjs
```

房间和段位细节见 [模块文档](../apps/web/docs/联机部署与星图段位.md)。
