# 同词相遇 ♡

中文双人实时联想游戏，视觉风格参照截图的象牙白、薰衣草紫与薄荷绿；结果页按轮次展示双方词语，匹配用 ✓ 标记。

## 本地运行
需要 Node.js 18+：

```bash
npm install
npm start
```

打开 http://localhost:3000 ，两个人要访问相同的部署网址，靠房间码/邀请链接连接。

## Railway 部署（推荐）
1. 在项目目录运行 `git init` 并将文件提交推送到 GitHub。
2. 打开 https://railway.com/new ，选择 **Deploy from GitHub Repo** 并选择此仓库。
3. Railway 会自动识别 Node.js，或使用附带的 `railway.json`；启动命令 `npm start`。
4. 在项目的 **Settings → Networking → Public Networking** 点击 **Generate Domain**，生成 https 域名。
5. 将该域名发给另一位玩家。不要设置多副本（保持 **1 replica**）。

## Heroku 部署
1. 安装 Heroku CLI 并登录：`heroku login`。
2. 创建应用：`heroku create 你喜欢的唯一应用名`，或使用已创建的 Heroku app。
3. 在 Git 仓库目录提交文件，运行 `git push heroku main`（若本地分支为 master，则改成 `master:main`）。
4. 运行 `heroku ps:scale web=1` 并用 `heroku open` 打开。
5. `Procfile` 已包含 `web: npm start`；服务监听平台提供的 `PORT`。

## 规则与注意
- 6 位房间码；双方提交后才显示这一轮的词，匹配则结束。
- 同一对玩家通过 WebSocket 实时同步；断线可用同一浏览器重连。
- **房间数据暂存服务器内存**：服务器重启、平台休眠或重新部署后，未结束的局会丢失；只支持一个服务副本。长期保存/扩容需 Redis 或数据库。
- 请不要部署多实例、也不要启用自动水平扩容；WebSocket 与内存房间状态需共存于单个进程。

## 正确玩法（2026-10-31 更新）

- 第 1 轮：两位玩家分别自由输入任意词语。
- 第 2 轮开始：每人必须结合**上一轮双方的两个词语**进行关联联想，并输入一个新词。页面会同时显示上轮的两个词方便参考。
- 双方均提交后才揭晓；只有两个词完全一致才结束游戏。
- 注意：联想是否真的同时参考两个词属于人的创意，系统无法客观自动判断；双方按规则自觉进行。
