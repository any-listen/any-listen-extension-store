import { randomUUID, createVerify } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { request, interceptors, getGlobalDispatcher, setGlobalDispatcher } from 'undici'

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

const tempDir = path.join(import.meta.dirname, '../temp')
fs.mkdirSync(tempDir, { recursive: true })

export const getVersionInfo = async (url) => {
  const response = await request(url, {
    bodyTimeout: defaultOptions.timeout,
    headersTimeout: defaultOptions.timeout,
    headers: defaultOptions.headers,
  })
  if (response.statusCode !== 200) {
    throw new Error(`Failed to fetch metadata from ${url}: ${response.statusCode}`)
  }

  const data = await response.body.json()
  return data
}

const EXTENSION = {
  pkgExtName: 'alix',
  extDirName: 'ext',
  tempDirName: 'temp',
  dataDirName: 'datas',
  configFileName: 'extensions.json',
  mainifestName: 'manifest.json',
  logFileName: 'output.log',
  signFileName: 'sig',
  extBundleFileName: 'ext.tgz',
  publicKeyHeader: '-----BEGIN PUBLIC KEY-----\n',
  publicKeyFooter: '\n-----END PUBLIC KEY-----',
}
const FILE_EXT_NAME_EXP = new RegExp(`\\.${EXTENSION.pkgExtName}$`, 'i')
const GRANTS = ['music_list', 'player', 'internet']
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
  'leaderboard',
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
export const checkFile = async (path) =>
  fs.promises
    .access(path, fs.constants.F_OK)
    .then(() => true)
    .catch(() => false)
const buildPath = async (extensionPath, _path) => {
  if (path.isAbsolute(_path)) throw new Error(`path not a relative path: ${_path}`)
  const enterFilePath = path.join(extensionPath, _path)
  if (!enterFilePath.startsWith(extensionPath + path.sep)) throw new Error('main path illegal')
  if (!(await checkFile(enterFilePath))) return ''
  if (!availableIcons.includes(path.extname(enterFilePath).toLowerCase())) throw new Error('Icon file type not supported')
  return enterFilePath
}
const verifyManifest = async (extensionPath, manifest) => {
  if (manifest.id != null) manifest.id = String(manifest.id)
  if (!manifest.id) throw new Error('Manifest id not defined')
  if (/[^\w-_]/.test(manifest.id)) throw new Error('Manifest ID Invalid')

  if (manifest.name != null) manifest.name = String(manifest.name)
  if (!manifest.name) throw new Error('Manifest name not defined')

  if (manifest.description != null) {
    manifest.description = String(manifest.description)
  }
  if (manifest.icon != null) manifest.icon = String(manifest.icon)
  manifest.icon = manifest.icon ? await buildPath(extensionPath, manifest.icon).catch(() => '') : ''
  if (manifest.icon) {
    const extPath = path.join(import.meta.dirname, '../extensions', manifest.id)
    for (const name of await fs.promises.readdir(extPath)) {
      if (name.startsWith('icon.')) {
        await fs.promises.rm(path.join(extPath, name), { force: true, recursive: true }).catch(() => {})
      }
    }
    const iconName = path.basename(manifest.icon)
    await fs.promises.cp(manifest.icon, path.join(extPath, `icon${path.extname(iconName)}`))
    manifest.icon = `https://raw.githubusercontent.com/any-listen/any-listen-extension-store/main/extensions/${manifest.id}/${iconName}`
  }

  if (manifest.main != null) manifest.main = String(manifest.main)
  if (!manifest.main) throw new Error('Main enter not defined')

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
  if (typeof manifest.contributes == 'object') {
    const contributes = {}
    if (Array.isArray(manifest.contributes.resource)) {
      contributes.resource = manifest.contributes.resource.map((resource) => {
        return {
          id: String(resource.id),
          name: String(resource.name),
          resource: resource.resource.filter((r) => RESOURCE.includes(r)),
        }
      })
    }
    if (Array.isArray(manifest.contributes.settings)) {
      contributes.settings = manifest.contributes.settings
        .map((s) => {
          switch (s.type) {
            case 'input':
              return {
                field: String(s.field),
                name: String(s.name),
                description: String(s.description),
                type: s.type,
                textarea: Boolean(s.textarea),
                default: String(s.default),
              }
            case 'boolean':
              return {
                field: String(s.field),
                name: String(s.name),
                description: String(s.description),
                type: s.type,
                default: Boolean(s.default),
              }
            case 'selection':
              return {
                field: String(s.field),
                name: String(s.name),
                description: String(s.description),
                type: s.type,
                default: String(s.default),
                enum: s.enum.map((e) => String(e)),
                enumName: s.enumName.map((e) => String(e)),
              }
            default:
              console.log(`Unknown setting type: ${s.type}`)
              return null
          }
        })
        .filter((s) => s != null)
    }
    manifest.contributes = contributes
  } else manifest.contributes = {}

  return manifest
}

const verifySignature = (data, publicKey, signature) => {
  const verify = createVerify('SHA256')
  verify.update(data)
  verify.end()
  const isValid = verify.verify(publicKey, signature, 'hex')
  return isValid
}

const buildExtensionI18nMessage = async (extensionPath) => {
  const i18nMessages = {}
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
    console.warn(`parse i18n messages failed, path: ${extensionPath}, error: ${err.message}`)
  }
  return i18nMessages
}
const parseExtension = async (extensionPath, pubKey) => {
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
  if (!manifest) return [null, null]
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
      publicKey: pubKey,
    },
    await buildExtensionI18nMessage(extensionPath),
  ]
}

const unpack = async (filePath, dist, opts = {}) => {
  const { x } = await import('tar')
  return x({
    file: filePath,
    C: dist,
    ...opts,
  })
}

const verifyExtension = async (unpackDir) => {
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
  return [ext, i18nMessages]
}
const getFileStats = async (path) => fs.promises.stat(path).catch(() => null)
const removePath = async (path) => fs.promises.rm(path, { recursive: true })
const parseManifest = async (bundlePath, publicKey) => {
  const targetDir = bundlePath.replace(FILE_EXT_NAME_EXP, '')
  await fs.promises.mkdir(targetDir, { recursive: true })
  await unpack(bundlePath, targetDir).catch(async (err) => {
    await removePath(targetDir)
    throw err
  })
  const [ext, i18nMessages] = await verifyExtension(targetDir)
  if (publicKey && ext.publicKey != publicKey) throw new Error('Public key mismatch')
  return [ext, i18nMessages]
}

export const parseExtMetadata = async (url, publicKey) => {
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

export const checkDownloadUrl = async (url) => {
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
