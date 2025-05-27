# Any Listen extension store

This is the extension store repository for the Any Listen project. This repository is used to store and provide the data required for Any Listen's online extension functionality.

## Creating your extension

We provide project templates to help you quickly create extensions

*Project templates are still in preparation...*

## Publishing your extension

1. Fork this repository
2. Add a `meta.json` file in the `extensions/<Extension ID>` directory
3. Submit a PR

### `meta.json` file description

We support two release modes: one is to host the extension package yourself, and the other is to host it in this repository.

#### Self-hosting (recommended)

When self-hosting, you need to provide an HTTP URL to a `version.json` file. This file records the latest version and download address of your extension. The extension store will periodically check this file for updates and synchronize new versions to the store if detected.

Following are the available fields of `meta.json` file:

|     Field Name     | Description                                                                                           |
| :----------------: | ----------------------------------------------------------------------------------------------------- |
|        `id`        | Extension ID                                                                                          |
| `version_info_url` | HTTP URL pointing to the `version.json` file, used to synchronize the latest version of the extension |

Example:

```json
{
  "id": "online-metadata",
  "version_info_url": "https://github.com/any-listen/any-listen-extension-online-metadata/releases/latest/download/version.json"
}
```

The following is the introduction of `version.json`:

|   Field Name   | Description                                                                                                                                |
| :------------: | ------------------------------------------------------------------------------------------------------------------------------------------ |
|   `version`    | The latest version number                                                                                                                  |
| `download_url` | Download URL for this version of the extension package (HTTP protocol)                                                                     |
|     `log`      | Update log, use markdown syntax (optional, reserved field)                                                                                 |
|     `date`     | Release date (optional, reserved field)                                                                                                    |
|   `history`    | Version history (optional, reserved field); this field is an array, and each element contains `version`, `download_url`, `log`, and `date` |

Example:

```json
{
  "version": "0.2.1",
  "download_url": "https://github.com/any-listen/any-listen-extension-online-metadata/releases/download/v0.2.1/online-metadata_v0.2.1.alix",
  "log": "### Feature\n\n- Support extension store",
  "date": "2025-05-27T02:43:25.844Z"
}
```

#### Repository Hosting

When hosting in this repository, you need to upload the extension package to `extensions/<Extension ID>`. Each time you release a new version of your extension, you need to submit a PR to upload the latest extension package to this repository.

The available fields for the `meta.json` file in this mode are as follows:

|   Field Name   | Description  |
| :------------: | ------------ |
|      `id`      | Extension ID |
| `package_name` | Package name |

Example:

```json
{
  "id": "online-metadata",
  "package_name": "online-metadata_v0.2.1.alix"
}
```

## License

This project is licensed under the Affero General Public License (AGPL) v3.0 with the following additional terms:

- Commercial use is strictly prohibited unless prior written permission is obtained from the original author.
- See the LICENSE file for full details.
