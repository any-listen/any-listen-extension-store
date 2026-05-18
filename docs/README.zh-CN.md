# Any Listen 扩展商店

[English](../README.md) | 简体中文

这是 Any Listen 项目的扩展商店仓库。该仓库用于存储并提供 Any Listen 在线扩展功能所需的数据。

## 创建你的扩展

我们提供项目模板，帮助你快速创建扩展。

```bash
npm create @any-listen/extension@latest
# 或
pnpm create @any-listen/extension@latest
```

## 发布你的扩展

1. Fork 本仓库
2. 在 `extensions/<Extension ID>` 目录下新增 `meta.json` 文件
3. 提交 PR， **并附上该扩展的功能说明**

### `meta.json` 文件说明

我们支持两种发布方式：一种是自行托管扩展包，另一种是托管在本仓库中。

#### 自行托管（推荐）

自行托管时，你需要提供一个指向 `version.json` 的 HTTP URL。该文件记录了扩展的最新版本与下载地址。扩展商店会定期检查该文件，如果检测到新版本，将同步到商店。

`meta.json` 可用字段如下：

|       字段名       | 说明                                                  |
| :----------------: | ----------------------------------------------------- |
|        `id`        | 扩展 ID                                               |
| `version_info_url` | 指向 `version.json` 的 HTTP URL，用于同步扩展最新版本 |

示例：

```json
{
  "id": "online-metadata",
  "version_info_url": "https://github.com/any-listen/any-listen-extension-online-metadata/releases/latest/download/version.json"
}
```

下面是 `version.json` 的说明：

|     字段名     | 说明                                                                                            |
| :------------: | ----------------------------------------------------------------------------------------------- |
|   `version`    | 最新版本号                                                                                      |
| `download_url` | 该版本扩展包的下载 URL（HTTP 协议）                                                             |
|     `log`      | 更新日志，使用 Markdown 语法（可选，预留字段）                                                  |
|     `date`     | 发布时间（可选，预留字段）                                                                      |
|   `history`    | 版本历史（可选，预留字段）；该字段为数组，每个元素包含 `version`、`download_url`、`log`、`date` |

示例：

```json
{
  "version": "0.2.1",
  "download_url": "https://github.com/any-listen/any-listen-extension-online-metadata/releases/download/v0.2.1/online-metadata_v0.2.1.alix",
  "log": "### Feature\n\n- Support extension store",
  "date": "2025-05-27T02:43:25.844Z"
}
```

#### 仓库托管

托管在本仓库时，你需要将扩展包上传到 `extensions/<Extension ID>` 目录。每次发布新版本时，需要提交 PR，将最新扩展包上传到本仓库。

该模式下 `meta.json` 可用字段如下：

|     字段名     | 说明    |
| :------------: | ------- |
|      `id`      | 扩展 ID |
| `package_name` | 包名    |

示例：

```json
{
  "id": "online-metadata",
  "package_name": "online-metadata_v0.2.1.alix"
}
```

## 许可证

本项目基于 Affero General Public License (AGPL) v3.0 许可证，并附加以下条款：

- 未经原作者书面许可，禁止任何商业用途。
- 详见 LICENSE 文件。
