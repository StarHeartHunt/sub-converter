# Sub Converter

[中文文档](README-CN.md)

A Nuxt-based subscription converter for transforming proxy client configurations between various formats. Conversion logic aligned with [subconverter](https://github.com/tindy2013/subconverter).

## Supported Protocols

| Protocol           | Parse | Generate |
| ------------------ | ----- | -------- |
| Shadowsocks (SS)   | ✅    | ✅       |
| ShadowsocksR (SSR) | ✅    | ✅       |
| VMess              | ✅    | ✅       |
| VLESS              | ✅    | ✅       |
| Trojan             | ✅    | ✅       |
| Hysteria2          | ✅    | ✅       |

## Supported Client Formats

| Client           | target value       |
| ---------------- | ------------------ |
| Clash / ClashR   | `clash` / `clashr` |
| sing-box         | `singbox`          |
| Surge 3/4        | `surge`            |
| Quantumult X     | `quanx`            |
| Loon             | `loon`             |
| Surfboard        | `surfboard`        |
| V2Ray / Mixed    | `v2ray` / `mixed`  |
| Shadowsocks Sub  | `ss` / `sssub`     |
| ShadowsocksR Sub | `ssr`              |

## Built-in Rule Configs

17 ACL4SSR rule configurations are bundled in `server/lib/rules/config/`, no external GitHub dependency required:

- **ACL4SSR_Online** — Default (ad-block + auto speed-test + Microsoft/Apple split)
- **ACL4SSR_Online_Full** — Full groups (Netflix, YouTube, Bilibili, Gaming, regional nodes, etc.)
- **ACL4SSR_Online_Mini** — Minimal (core rules, fewest groups)
- **ACL4SSR_Online_NoAuto / Full_NoAuto / Mini_NoAuto** — No auto speed-test variants
- **ACL4SSR_Online_AdblockPlus / Full_AdblockPlus / Mini_AdblockPlus** — Enhanced ad-blocking
- **ACL4SSR_Online_Full_MultiMode / Mini_MultiMode** — Multi-mode
- **ACL4SSR_Online_MultiCountry / Mini_MultiCountry** — Multi-country node groups
- **ACL4SSR_Online_NoReject** — No reject rules
- **ACL4SSR_Online_Full_Netflix / Full_Google** — Netflix/Google dedicated groups
- **ACL4SSR_Online_Mini_Fallback** — Minimal fallback mode

96 emoji flag rules are bundled in `server/lib/rules/snippets/emoji.txt` for automatic country flag tagging on node names.

## API

### `GET /api/sub`

Main conversion endpoint.

**Required Parameters:**

| Param    | Description                            |
| -------- | -------------------------------------- |
| `target` | Target format (see table above)        |
| `url`    | Subscription URL(s), separated by `\|` |

**Optional Parameters:**

| Param         | Default | Description                                                 |
| ------------- | ------- | ----------------------------------------------------------- |
| `config`      | —       | Rule config name (e.g. `ACL4SSR_Online`) or remote URL      |
| `emoji`       | `true`  | Add country flag emoji to node names                        |
| `include`     | —       | Include nodes matching regex                                |
| `exclude`     | —       | Exclude nodes matching regex                                |
| `rename`      | —       | Rename rules: `pattern@replacement`, separated by backticks |
| `sort`        | `false` | Sort nodes by name                                          |
| `udp`         | `false` | Force enable UDP                                            |
| `tfo`         | `false` | Force enable TCP Fast Open                                  |
| `scv`         | `false` | Skip certificate verification                               |
| `append_type` | `false` | Prepend type label `[SS]` `[VMess]` etc.                    |
| `list`        | `false` | Output node list only                                       |
| `filename`    | —       | Download filename                                           |
| `ver`         | —       | Surge version (3 or 4)                                      |

**Example:**

```
/api/sub?target=clash&url=https://example.com/sub&config=ACL4SSR_Online_Full
```

### `GET /api/config/:name`

Retrieve a built-in rule configuration file.

```
/api/config/ACL4SSR_Online.ini
```

## Development

```bash
# Install dependencies
pnpm install

# Start dev server (http://localhost:3000)
pnpm dev
```

## Build & Deploy

```bash
# Build
pnpm build

# Run
node .output/server/index.mjs
```

## Tech Stack

- **Framework:** Nuxt 4 + Nitro
- **Frontend:** Vue 3 + Nuxt UI + Tailwind CSS
- **Runtime:** Node.js

## Credits

- [subconverter](https://github.com/tindy2013/subconverter) — Core conversion logic reference
- [ACL4SSR](https://github.com/ACL4SSR/ACL4SSR) — Built-in rule configurations
