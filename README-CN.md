# Sub Converter

[English](README.md)

基于 Nuxt 的订阅转换工具，用于在各种代理客户端配置格式之间互相转换。转换逻辑对齐 [subconverter](https://github.com/tindy2013/subconverter)。

## 支持的协议

| 协议                | 解析 | 输出 |
| ------------------- | ---- | ---- |
| Shadowsocks (SS)    | ✅   | ✅   |
| ShadowsocksR (SSR)  | ✅   | ✅   |
| VMess               | ✅   | ✅   |
| VLESS               | ✅   | ✅   |
| Trojan              | ✅   | ✅   |
| Hysteria2           | ✅   | ✅   |

## 支持的客户端格式

| 客户端              | target 值          |
| ------------------- | ------------------ |
| Clash / ClashR      | `clash` / `clashr` |
| sing-box            | `singbox`          |
| Surge 3/4           | `surge`            |
| Quantumult X        | `quanx`            |
| Loon                | `loon`             |
| Surfboard           | `surfboard`        |
| V2Ray / Mixed       | `v2ray` / `mixed`  |
| Shadowsocks 订阅    | `ss` / `sssub`     |
| ShadowsocksR 订阅   | `ssr`              |

## 内置规则配置

项目内置了 17 套 ACL4SSR 规则配置（位于 `server/lib/rules/config/`），无需依赖外部 GitHub 链接：

- **ACL4SSR_Online** — 默认版（去广告 + 自动测速 + 微软/苹果分流）
- **ACL4SSR_Online_Full** — 全分组（含奈飞、油管、哔哩哔哩、游戏等独立分组 + 地区节点）
- **ACL4SSR_Online_Mini** — 精简版（核心规则，最少分组）
- **ACL4SSR_Online_NoAuto / Full_NoAuto / Mini_NoAuto** — 无自动测速变体
- **ACL4SSR_Online_AdblockPlus / Full_AdblockPlus / Mini_AdblockPlus** — 增强去广告
- **ACL4SSR_Online_Full_MultiMode / Mini_MultiMode** — 多模式
- **ACL4SSR_Online_MultiCountry / Mini_MultiCountry** — 多国家节点分组
- **ACL4SSR_Online_NoReject** — 无拦截
- **ACL4SSR_Online_Full_Netflix / Full_Google** — 奈飞/谷歌专用分组
- **ACL4SSR_Online_Mini_Fallback** — 精简 Fallback 模式

内置 96 条 Emoji 国旗规则（`server/lib/rules/snippets/emoji.txt`），自动为节点添加国旗标识。

## API

### `GET /api/sub`

主转换接口。

**必选参数：**

| 参数     | 说明                         |
| -------- | ---------------------------- |
| `target` | 目标格式（见上表）           |
| `url`    | 订阅链接，多个用 `\|` 分隔   |

**可选参数：**

| 参数          | 默认值  | 说明                                                     |
| ------------- | ------- | -------------------------------------------------------- |
| `config`      | —       | 规则配置名（如 `ACL4SSR_Online`）或远程 URL              |
| `emoji`       | `true`  | 添加国旗 Emoji                                           |
| `include`     | —       | 节点名称包含（正则）                                     |
| `exclude`     | —       | 节点名称排除（正则）                                     |
| `rename`      | —       | 重命名规则，格式 `pattern@replacement`，多条用反引号分隔 |
| `sort`        | `false` | 按名称排序                                               |
| `udp`         | `false` | 强制开启 UDP                                             |
| `tfo`         | `false` | 强制开启 TCP Fast Open                                   |
| `scv`         | `false` | 跳过证书验证                                             |
| `append_type` | `false` | 节点名前添加类型标注 `[SS]` `[VMess]` 等                 |
| `list`        | `false` | 仅输出节点列表                                           |
| `filename`    | —       | 下载文件名                                               |
| `ver`         | —       | Surge 版本号（3 或 4）                                   |

**示例：**

```
/api/sub?target=clash&url=https://example.com/sub&config=ACL4SSR_Online_Full
```

### `GET /api/config/:name`

获取内置规则配置文件内容。

```
/api/config/ACL4SSR_Online.ini
```

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器 (http://localhost:3000)
pnpm dev
```

## 构建部署

```bash
# 构建
pnpm build

# 运行
node .output/server/index.mjs
```

## 技术栈

- **框架：** Nuxt 4 + Nitro
- **前端：** Vue 3 + Nuxt UI + Tailwind CSS
- **运行时：** Node.js

## 致谢

- [subconverter](https://github.com/tindy2013/subconverter) — 核心转换逻辑参考
- [ACL4SSR](https://github.com/ACL4SSR/ACL4SSR) — 内置规则配置来源
