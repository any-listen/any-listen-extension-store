declare global {
  namespace AnyListen {
    namespace Store {
      interface ExtensionList {
        all: ExtensionListItem[]
      }

      interface ExtensionListItem {
        id: Extension.Manifest['id']
        name: Extension.Manifest['name']
        description: Extension.Manifest['description']
        version: Extension.Manifest['version']
        author: Extension.Manifest['author']
        grant: Extension.Manifest['grant']
        license: Extension.Manifest['license']
        categories: Extension.Manifest['categories']
        tags: Extension.Manifest['tags']
        homepage: Extension.Manifest['homepage']
        publicKey: Extension.Manifest['publicKey']
        icon: Extension.Manifest['icon']
        target_engine: Extension.Manifest['target_engine']
        download_url: string
      }

      interface ExtensionRegistryItem extends Extension.Manifest {
        download_url: string
      }

      type I18nMessages = Record<string, Record<string, string>>

      interface VersionInfo {
        version: string
        download_url: string
        log?: string
        date?: Date
        history?: VersionInfo[]
      }
    }
  }
}

export {}
