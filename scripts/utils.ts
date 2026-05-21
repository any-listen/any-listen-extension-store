import { randomUUID, createVerify, createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { TarOptionsWithAliases } from 'tar'
import { request, interceptors, getGlobalDispatcher, setGlobalDispatcher } from 'undici'

export const dataDir = path.join(import.meta.dirname, '../datas')

const defaultOptions = {
  timeout: 15000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36',
  },
  maxRedirect: 3,
}
const dispatchers = [
  interceptors.redirect({
    maxRedirections: defaultOptions.maxRedirect,
  }),
  interceptors.retry({
    maxRetries: 3,
    minTimeout: 1000,
    maxTimeout: 10000,
    timeoutFactor: 2,
    retryAfter: true,
  }),
  // interceptors.responseError(),
]
setGlobalDispatcher(getGlobalDispatcher().compose(...dispatchers))

const tempDir = path.join(import.meta.dirname, 'temp')
fs.mkdirSync(tempDir, { recursive: true })

export const getVersionInfo = async (url: string) => {
  const response = await request(url, {
    bodyTimeout: defaultOptions.timeout,
    headersTimeout: defaultOptions.timeout,
    headers: defaultOptions.headers,
  })
  if (response.statusCode !== 200) {
    throw new Error(`Failed to fetch metadata from ${url}: ${response.statusCode}`)
  }

  const data = await response.body.json()
  return data as AnyListen.Store.VersionInfo
}

const EXTENSION = {
  pkgExtName: 'alix',
  extDirName: 'ext',
  tempDirName: 'temp',
  dataDirName: 'datas',
  storageDirName: 'storage',
  resourceDirName: 'resources',
  storageDirPrefix: '@storage',
  extensionDirPrefix: '@root',
  configFileName: 'extensions.json',
  mainifestName: 'manifest.json',
  logFileName: 'output.log',
  signFileName: 'sig',
  extBundleFileName: 'ext.tgz',
  publicKeyHeader: '-----BEGIN PUBLIC KEY-----\n',
  publicKeyFooter: '\n-----END PUBLIC KEY-----',
} as const
const FILE_EXT_NAME_EXP = new RegExp(`\\.${EXTENSION.pkgExtName}$`, 'i')
const GRANTS: AnyListen.Extension.Grant[] = ['music_list', 'player', 'internet', 'isolate_context']
const RESOURCE = [
  'tipSearch',
  'hotSearch',
  'musicSearch',
  'musicPic',
  'musicLyric',
  'musicUrl',
  'musicPicSearch',
  'songlistSearch',
  'songlist',
  'topSongs',
  'albumSearch',
  'album',
  'singerSearch',
  'singer',
  'lyricSearch',
  'lyricDetail',
]
const availableLanges = [
  'ar-sa',
  'cs-cz',
  'da-dk',
  'de-de',
  'el-gr',
  'en-au',
  'en-gb',
  'en-ie',
  'en-us',
  'en-za',
  'es-es',
  'es-mx',
  'fi-fi',
  'fr-ca',
  'fr-fr',
  'he-il',
  'hi-in',
  'hu-hu',
  'id-id',
  'it-it',
  'ja-jp',
  'ko-kr',
  'nl-be',
  'nl-nl',
  'no-no',
  'pl-pl',
  'pt-br',
  'pt-pt',
  'ro-ro',
  'ru-ru',
  'sk-sk',
  'sv-se',
  'th-th',
  'tr-tr',
  'zh-cn',
  'zh-hk',
  'zh-tw',
]
const availableIcons = ['.png', '.jpg', '.jpeg', '.webp', '.svg']
export const checkFile = async (path: string) =>
  fs.promises
    .access(path, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false)
const buildPath = async (extensionPath: string, _path: string) => {
  if (path.isAbsolute(_path)) throw new Error(`path not a relative path: ${_path}`)
  const enterFilePath = path.join(extensionPath, _path)
  if (!enterFilePath.startsWith(extensionPath + path.sep)) throw new Error('main path illegal')
  if (!(await checkFile(enterFilePath))) return ''
  // check file size, if larger than 1MB, return empty string
  const stats = await fs.promises.stat(enterFilePath)
  if (stats.size > 1 * 1024 * 1024) {
    // TODO: resize image
    console.warn(`File ${enterFilePath} is larger than 1MB, skipping`)
    return ''
  }
  return enterFilePath
}
type Contributes = NonNullable<AnyListen.Extension.Manifest['contributes']>

const parseResource = (resource: NonNullable<Contributes['resource']>): NonNullable<Contributes['resource']> => {
  return resource.map((resource) => {
    return {
      id: String(resource.id),
      name: String(resource.name),
      resource: resource.resource.filter((r) => RESOURCE.includes(r)),
    }
  })
}
const parseSettings = (settings: NonNullable<Contributes['settings']>): NonNullable<Contributes['settings']> => {
  return settings
    .map((s) => {
      switch (s.type) {
        case 'input':
          return {
            type: s.type,
            field: String(s.field),
            name: String(s.name),
            description: String(s.description),
            textarea: Boolean(s.textarea),
            default: s.default == null ? undefined : String(s.default),
          } satisfies AnyListen.Extension.FormInput
        case 'boolean':
          return {
            type: s.type,
            field: String(s.field),
            name: String(s.name),
            description: String(s.description),
            default: s.default == null ? undefined : Boolean(s.default),
          } satisfies AnyListen.Extension.FormBoolean
        case 'selection':
          return {
            type: s.type,
            field: String(s.field),
            name: String(s.name),
            description: String(s.description),
            default: s.default == null ? undefined : String(s.default),
            enum: s.enum.map((e) => String(e)),
            enumName: s.enumName.map((e) => String(e)),
          } satisfies AnyListen.Extension.FormSelection
        case 'configCheckbox':
          return {
            type: s.type,
            field: String(s.field),
            name: String(s.name),
            description: String(s.description),
            default: s.default == null ? undefined : String(s.default),
            enumConfigFiled: String(s.enumConfigFiled),
            enumFiled: String(s.enumFiled),
            enumNameFiled: String(s.enumNameFiled),
            enumDescriptionFiled: s.enumDescriptionFiled ? String(s.enumDescriptionFiled) : undefined,
            removeable: s.removeable ? Boolean(s.removeable) : undefined,
            actionCommands: Array.isArray(s.actionCommands) ? s.actionCommands.map((c) => String(c)) : undefined,
            actionCommandNames: Array.isArray(s.actionCommandNames) ? s.actionCommandNames.map((c) => String(c)) : undefined,
          } satisfies AnyListen.Extension.FormConfigCheckbox
        case 'configCheckboxMultiple':
          return {
            type: s.type,
            field: String(s.field),
            name: String(s.name),
            description: String(s.description),
            default: s.default == null ? undefined : s.default.map((d) => String(d)),
            max: typeof s.max === 'number' ? Math.max(s.max, 0) : undefined,
            enumConfigFiled: String(s.enumConfigFiled),
            enumFiled: String(s.enumFiled),
            enumNameFiled: String(s.enumNameFiled),
            enumDescriptionFiled: s.enumDescriptionFiled ? String(s.enumDescriptionFiled) : undefined,
            removeable: s.removeable ? Boolean(s.removeable) : undefined,
            actionCommands: s.actionCommands == null ? undefined : s.actionCommands.map((c) => String(c)),
            actionCommandNames: s.actionCommandNames == null ? undefined : s.actionCommandNames.map((c) => String(c)),
          } satisfies AnyListen.Extension.FormConfigCheckboxMultiple

        // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
        default:
          // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-case-declarations
          let neverValue: never = s
          // throw new Error(`Unknown setting type: ${s.type}`)
          // @ts-expect-error
          console.log(`Unknown setting type: ${s.type}`)
          return null
      }
    })
    .filter((s) => s != null)
}
const parseListProviders = (
  listProviders: NonNullable<Contributes['listProviders']>
): NonNullable<Contributes['listProviders']> => {
  return listProviders.map((p) => {
    p.id = String(p.id)
    p.name = String(p.name)
    p.description = String(p.description)
    if (p.fileSortable != null) p.fileSortable = Boolean(p.fileSortable)
    p.form = p.form
      .map((s) => {
        switch (s.type) {
          case 'input':
            return {
              type: s.type,
              field: String(s.field),
              name: String(s.name),
              description: String(s.description),
              textarea: Boolean(s.textarea),
              default: s.default == null ? undefined : String(s.default),
            } satisfies AnyListen.Extension.FormInput
          case 'boolean':
            return {
              type: s.type,
              field: String(s.field),
              name: String(s.name),
              description: String(s.description),
              default: s.default == null ? undefined : Boolean(s.default),
            } satisfies AnyListen.Extension.FormBoolean
          case 'selection':
            return {
              type: s.type,
              field: String(s.field),
              name: String(s.name),
              description: String(s.description),
              default: s.default == null ? undefined : String(s.default),
              enum: s.enum.map((e) => String(e)),
              enumName: s.enumName.map((e) => String(e)),
            } satisfies AnyListen.Extension.FormSelection
          case 'configCheckbox':
            return {
              type: s.type,
              field: String(s.field),
              name: String(s.name),
              description: String(s.description),
              default: s.default == null ? undefined : String(s.default),
              enumConfigFiled: String(s.enumConfigFiled),
              enumFiled: String(s.enumFiled),
              enumNameFiled: String(s.enumNameFiled),
              enumDescriptionFiled: s.enumDescriptionFiled ? String(s.enumDescriptionFiled) : undefined,
              removeable: s.removeable ? Boolean(s.removeable) : undefined,
              actionCommands: Array.isArray(s.actionCommands) ? s.actionCommands.map((c) => String(c)) : undefined,
              actionCommandNames: Array.isArray(s.actionCommandNames) ? s.actionCommandNames.map((c) => String(c)) : undefined,
            } satisfies AnyListen.Extension.FormConfigCheckbox
          case 'configCheckboxMultiple':
            return {
              type: s.type,
              field: String(s.field),
              name: String(s.name),
              description: String(s.description),
              default: s.default == null ? undefined : s.default.map((d) => String(d)),
              max: typeof s.max === 'number' ? Math.max(s.max, 0) : undefined,
              enumConfigFiled: String(s.enumConfigFiled),
              enumFiled: String(s.enumFiled),
              enumNameFiled: String(s.enumNameFiled),
              enumDescriptionFiled: s.enumDescriptionFiled ? String(s.enumDescriptionFiled) : undefined,
              removeable: s.removeable ? Boolean(s.removeable) : undefined,
              actionCommands: Array.isArray(s.actionCommands) ? s.actionCommands.map((c) => String(c)) : undefined,
              actionCommandNames: Array.isArray(s.actionCommandNames) ? s.actionCommandNames.map((c) => String(c)) : undefined,
            } satisfies AnyListen.Extension.FormConfigCheckboxMultiple
          case 'lazzyParseMeta':
            return {
              type: s.type,
              default: s.default == null ? undefined : Boolean(s.default),
            } satisfies AnyListen.Extension.FormLazzyParseMeta
          // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
          default:
            // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-case-declarations
            let neverValue: never = s
            // throw new Error(`Unknown setting type: ${s.type}`)
            // @ts-expect-error
            console.log(`Unknown setting type: ${s.type}`)
            return null
        }
      })
      .filter((s) => s != null)

    return {
      id: p.id,
      name: p.name,
      description: p.description,
      fileSortable: p.fileSortable,
      form: p.form,
    }
  })
}
const parseCommands = (commands: NonNullable<Contributes['commands']>): NonNullable<Contributes['commands']> => {
  return commands.map((c) => {
    return {
      command: String(c.command),
      name: String(c.name),
      description: String(c.description),
      hidden: c.hidden ? Boolean(c.hidden) : false,
    }
  })
}

const parseContributes = (rawContributes: AnyListen.Extension.Manifest['contributes']): Contributes => {
  if (typeof rawContributes != 'object') return {}
  const contributes: Contributes = {}

  if (Array.isArray(rawContributes.resource)) contributes.resource = parseResource(rawContributes.resource)

  if (Array.isArray(rawContributes.settings)) {
    contributes.settings = parseSettings(rawContributes.settings)
  }
  if (Array.isArray(rawContributes.listProviders)) {
    contributes.listProviders = parseListProviders(rawContributes.listProviders)
  }
  if (Array.isArray(rawContributes.commands)) {
    contributes.commands = parseCommands(rawContributes.commands)
  }
  return contributes
}
const formatManifest = (manifest: AnyListen.Extension.Manifest) => {
  if (manifest.id != null) manifest.id = String(manifest.id)
  if (!manifest.id) throw new Error('Manifest id not defined')
  if (/[^\w-_.]/.test(manifest.id)) throw new Error('Manifest ID Invalid')

  if (manifest.name != null) manifest.name = String(manifest.name)
  if (!manifest.name) throw new Error('Manifest name not defined')

  if (manifest.description != null) manifest.description = String(manifest.description)
  if (manifest.icon != null) manifest.icon = String(manifest.icon)
  if (manifest.main != null) manifest.main = String(manifest.main)

  if (manifest.version != null) manifest.version = String(manifest.version)
  if (manifest.target_engine != null) manifest.target_engine = String(manifest.target_engine)
  if (manifest.author != null) manifest.author = String(manifest.author)
  if (manifest.homepage != null) manifest.homepage = String(manifest.homepage)
  if (manifest.license != null) manifest.license = String(manifest.license)
  if (Array.isArray(manifest.categories)) {
    manifest.categories = manifest.categories.map((categorie) => String(categorie))
  } else manifest.categories = []
  if (Array.isArray(manifest.tags)) {
    manifest.tags = manifest.tags.map((tag) => String(tag))
  } else manifest.tags = []
  if (Array.isArray(manifest.grant)) {
    manifest.grant = manifest.grant.filter((grant) => GRANTS.includes(grant))
  } else manifest.grant = []
  manifest.contributes = parseContributes(manifest.contributes)
}
const verifyManifest = async (extensionPath: string, manifest: AnyListen.Extension.Manifest) => {
  formatManifest(manifest)
  manifest.icon = manifest.icon ? await buildPath(extensionPath, manifest.icon).catch(() => '') : ''
  if (manifest.icon) {
    if (availableIcons.includes(path.extname(manifest.icon))) {
      const extPath = path.join(import.meta.dirname, '../extensions', manifest.id)
      for (const name of await fs.promises.readdir(extPath)) {
        if (name.startsWith('icon.')) {
          await fs.promises.rm(path.join(extPath, name), { force: true, recursive: true }).catch(() => {})
        }
      }
      const iconName = path.basename(manifest.icon)
      await fs.promises.cp(manifest.icon, path.join(extPath, `icon${path.extname(iconName)}`))
      manifest.icon = `https://raw.githubusercontent.com/any-listen/any-listen-extension-store/main/extensions/${manifest.id}/${iconName}`
    } else {
      manifest.icon = ''
    }
  }
  if (!manifest.main) throw new Error('Main enter not defined')
  return manifest
}

const verifySignature = (data: Buffer, publicKey: string, signature: string) => {
  const verify = createVerify('SHA256')
  verify.update(data)
  verify.end()
  const isValid = verify.verify(publicKey, signature, 'hex')
  return isValid
}

const buildExtensionI18nMessage = async (extensionPath: string) => {
  const i18nMessages: AnyListen.Store.I18nMessages = {}
  const i18nDir = path.join(extensionPath, 'i18n')
  try {
    const files = await fs.promises.readdir(i18nDir)
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      const lang = file.replace('.json', '')
      if (!availableLanges.includes(lang)) continue
      const filePath = path.join(i18nDir, file)
      const content = JSON.parse((await fs.promises.readFile(filePath, 'utf-8')).toString())
      for (const [key, val] of Object.entries(content)) {
        if (typeof val !== 'string') delete content[key]
      }
      i18nMessages[lang] = content
    }
  } catch (err) {
    console.warn(`parse i18n messages failed, path: ${extensionPath}, error: ${(err as Error).message}`)
  }
  return i18nMessages
}

const parseExtension = async (
  extensionPath: string,
  pubKey: string
): Promise<readonly [AnyListen.Extension.Manifest | null, AnyListen.Store.I18nMessages]> => {
  const manifest = await fs.promises
    .readFile(path.join(extensionPath, EXTENSION.mainifestName))
    .then(async (buf) => {
      const manifest = JSON.parse(buf.toString('utf-8'))
      return await verifyManifest(extensionPath, manifest)
    })
    .catch((err) => {
      console.log(err)
      return null
    })
  if (!manifest) return [null, {}]
  return [
    {
      id: manifest.id,
      name: manifest.name,
      description: manifest.description,
      icon: manifest.icon,
      version: manifest.version,
      target_engine: manifest.target_engine,
      author: manifest.author,
      homepage: manifest.homepage,
      license: manifest.license,
      categories: manifest.categories,
      tags: manifest.tags,
      grant: manifest.grant,
      contributes: manifest.contributes,
      main: manifest.main,
      publicKey: pubKey,
    } satisfies AnyListen.Extension.Manifest,
    await buildExtensionI18nMessage(extensionPath),
  ] as const
}

const unpack = async (filePath: string, dist: string, opts: TarOptionsWithAliases = {}) => {
  const { x } = await import('tar')
  return x({
    file: filePath,
    C: dist,
    ...opts,
  })
}

const verifyExtension = async (
  unpackDir: string
): Promise<readonly [AnyListen.Extension.Manifest, AnyListen.Store.I18nMessages]> => {
  const sigFilePath = path.join(unpackDir, EXTENSION.signFileName)
  const extBundleFilePath = path.join(unpackDir, EXTENSION.extBundleFileName)
  const pubKey = await Promise.all([
    fs.promises.readFile(sigFilePath).then(async (buf) => {
      const [sign, pubKey] = buf.toString('utf-8').split('\n')
      return [sign, pubKey]
    }),
    fs.promises.readFile(extBundleFilePath),
  ]).then(async ([signInfo, extData]) => {
    if (!signInfo || !extData) throw new Error('Signature file not found or invalid format')
    if (!verifySignature(extData, `${EXTENSION.publicKeyHeader}${signInfo[1]}${EXTENSION.publicKeyFooter}`, signInfo[0])) {
      throw new Error('Verification failed')
    }
    return signInfo[1]
  })

  const extDir = extBundleFilePath.replace(new RegExp(`${path.extname(EXTENSION.extBundleFileName).replaceAll('.', '\\.')}$`), '')
  await fs.promises.mkdir(extDir, { recursive: true })
  await unpack(extBundleFilePath, extDir).catch(async (err) => {
    await removePath(extDir)
    throw err
  })
  const [ext, i18nMessages] = await parseExtension(extDir, pubKey)
  if (!ext) throw new Error('Invalid Extension')
  return [ext, i18nMessages] as const
}
const getFileStats = async (path: string) => fs.promises.stat(path).catch(() => null)
const removePath = async (path: string) => fs.promises.rm(path, { recursive: true })
export const fileSha256 = async (filePath: string) => {
  const hash = createHash('sha256')
  const stream = fs.createReadStream(filePath)
  return new Promise<string>((resolve, reject) => {
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', (err) => reject(err))
  })
}

const parseManifest = async (bundlePath: string, publicKey?: string) => {
  const targetDir = bundlePath.replace(FILE_EXT_NAME_EXP, '')
  await fs.promises.mkdir(targetDir, { recursive: true })
  await unpack(bundlePath, targetDir).catch(async (err) => {
    await removePath(targetDir)
    throw err
  })
  const [ext, i18nMessages] = await verifyExtension(targetDir)
  if (publicKey && ext.publicKey != publicKey) throw new Error('Public key mismatch')
  return [ext, i18nMessages, await fileSha256(bundlePath)] as const
}

export const parseExtMetadata = async (url: string, publicKey?: string) => {
  if (!/^https?:\/\//i.test(url)) {
    const stats = await getFileStats(url)
    if (!stats) throw new Error(`Invalid extension path: ${url}`)
    const tempPath = path.join(tempDir, randomUUID() + '.' + EXTENSION.pkgExtName)
    await fs.promises.copyFile(url, tempPath)
    return parseManifest(tempPath, publicKey)
  }

  const bundlePath = path.join(tempDir, randomUUID() + '.' + EXTENSION.pkgExtName)

  const response = await request(url, {
    bodyTimeout: defaultOptions.timeout,
    headersTimeout: defaultOptions.timeout,
    headers: defaultOptions.headers,
  })

  if (response.statusCode !== 200) {
    throw new Error(`Failed to fetch metadata from ${url}: ${response.statusCode}`)
  }

  const data = await response.body.bytes()
  await fs.promises.writeFile(bundlePath, data)
  return parseManifest(bundlePath, publicKey)
}

export const checkDownloadUrl = async (url: string) => {
  if (!/^https?:\/\//i.test(url)) return false
  const response = await request(url, {
    method: 'HEAD',
    bodyTimeout: defaultOptions.timeout,
    headersTimeout: defaultOptions.timeout,
    headers: defaultOptions.headers,
  })
  if (response.statusCode !== 200) return false
  return true
}
