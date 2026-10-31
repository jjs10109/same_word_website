# 我们的游戏馆

双游戏网站：`/` 选择游戏；`/same.html` 双人同词相遇；`/liar.html` 2–4 人骗子酒馆简化卡牌版。

## 本地运行

```bash
npm install
npm start
```

访问 http://localhost:3000 。

## Railway / Heroku

保留 `railway.json`、`Procfile`、`package.json`。将本目录内容推送到连接 Railway/Heroku 的 GitHub 仓库，启动命令 `npm start`；Railway 在 Networking 生成域名。

## 规则

- 同词相遇：首轮自由联想，第二轮起结合前轮双方词语联想，同轮词语完全相同即成功。
- 骗子酒馆：每人 3 心，2–4 人；每局 5 张手牌，目标牌随机 A/K/Q，JOKER 万能。轮流暗扣 1–3 张并宣称全是目标牌。下一人质疑或接受。质疑若查出非目标牌，出牌人掉 1 心；若全部真实，质疑人掉 1 心。每次结算重新发牌。最后存活者获胜。

## 注意

房间在 Node.js 单进程内存中，服务重启后会丢失，不适合多实例水平扩容。若想长期保存游戏记录或多实例部署，需增加 Redis / PostgreSQL。
