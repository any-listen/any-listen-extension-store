import fs from 'node:fs'
import path from 'node:path'
import { dataDir, checkDownloadUrl, getVersionInfo, parseExtMetadata } from './utils.js'

const metaFileName = 'meta.json'
const i18nMessageKeys = ['description']

const listPath = path.join(dataDir, 'list.json')
const list = JSON.parse(fs.readFileSync(listPath, 'utf-8').toString()).all
const listMap = new Map()
const i18nMessages = {}
for (const ext of list) listMap.set(ext.id, ext)
for (const lang of fs.readdirSync(path.join(import.meta.dirname, '../i18n'))) {
  const langPath = path.join(import.meta.dirname, '../i18n', lang)
  const messages = JSON.parse(fs.readFileSync(langPath, 'utf-8').toString())
  i18nMessages[lang.replace('.json', '')] = messages
}

const registry = {}
const oldRegistry = {}
const registryPath = path.join(dataDir, 'registry')
if (fs.existsSync(registryPath)) {
  for (const name of fs.readdirSync(registryPath)) {
    const filePath = path.join(registryPath, name)
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8').toString())
    oldRegistry[content.id] = content
  }
}
fs.rmSync(registryPath, { recursive: true, force: true })
fs.mkdirSync(registryPath, { recursive: true })

const oldI18nMessages = {}
if (fs.existsSync(path.join(dataDir, 'i18n'))) {
  for (const lang of fs.readdirSync(path.join(dataDir, 'i18n'))) {
    const langPath = path.join(dataDir, 'i18n', lang)
    if (lang.endsWith('.json')) {
      const messages = JSON.parse(fs.readFileSync(langPath, 'utf-8').toString() || '{}')
      oldI18nMessages[lang.replace('.json', '')] = messages
    }
  }
}

const extensionsDirPath = path.join(import.meta.dirname, '../extensions')
const extensionDir = fs.readdirSync(extensionsDirPath)

const mergeI18nMessages = (id, i18n) => {
  for (const [lang, msgs] of Object.entries(i18n)) {
    let messages = i18nMessages[lang]
    if (!messages) messages = i18nMessages[lang] = {}
    for (const key of i18nMessageKeys) {
      if (!msgs[key]) continue
      messages[`${id}.${key}`] = msgs[key]
    }
  }
}
const cpI18nMessages = (id) => {
  for (const [langs, messages] of Object.entries(oldI18nMessages)) {
    if (!Object.keys(messages).some((key) => key.startsWith(`${id}.`))) continue
    if (!i18nMessages[langs]) i18nMessages[langs] = {}
    for (const [key, value] of Object.entries(messages)) {
      if (!key.startsWith(`${id}.`)) continue
      i18nMessages[langs][key] = value
    }
  }
}
const buildListItem = (ext) => {
  return {
    id: ext.id,
    name: ext.name,
    description: ext.description,
    version: ext.version,
    author: ext.author,
    grant: ext.grant,
    license: ext.license,
    target_engine: ext.target_engine,
    categories: ext.categories,
    tags: ext.tags,
    homepage: ext.homepage,
    publicKey: ext.publicKey,
    icon: ext.icon,
    download_url: ext.download_url,
  }
}

const parseVersionByInfoUrl = async (id, url) => {
  const versionInfo = await getVersionInfo(url)
  if (!versionInfo.version) throw new Error(`Version info not found for [${id}] at ${url}`)
  if (!versionInfo.download_url) throw new Error(`Download URL not found for [${id}] at ${url}`)
  const targetExt = listMap.get(id)
  if (targetExt) {
    if (targetExt.version === versionInfo.version) {
      cpI18nMessages(id)
      registry[id] = oldRegistry[id]
      if (await checkDownloadUrl(registry[id].download_url)) return
    }
    console.log(`Extension [${targetExt.name}] (${id}) version updated: ${targetExt.version} -> ${versionInfo.version}`)
    const [ext, i18n] = await parseExtMetadata(versionInfo.download_url, targetExt.publicKey)
    if (ext.id != id) throw new Error(`Extension ID mismatch: expected [${id}], got [${ext.id}]`)
    ext.download_url = versionInfo.download_url
    registry[id] = ext
    Object.assign(targetExt, buildListItem(ext))
    mergeI18nMessages(id, i18n)
  } else {
    console.log(`Extension [${id}] not exist in list.json, adding`)
    const [ext, i18n] = await parseExtMetadata(versionInfo.download_url, null)
    if (ext.id != id) throw new Error(`Extension ID mismatch: expected [${id}], got [${ext.id}]`)
    ext.download_url = versionInfo.download_url
    const listItem = buildListItem(ext)
    registry[id] = ext
    list.push(listItem)
    listMap.set(ext.id, listItem)
    mergeI18nMessages(id, i18n)
  }
}

const parseVersionByPkgPath = async (id, url) => {
  const targetExt = listMap.get(id)
  if (targetExt) {
    const [ext, i18n] = await parseExtMetadata(url, targetExt.publicKey)
    if (ext.id != id) throw new Error(`Extension ID mismatch: expected [${id}], got [${ext.id}]`)
    if (targetExt.version === ext.version) {
      cpI18nMessages(id)
      registry[id] = oldRegistry[id]
      return
    }
    console.log(`Extension [${targetExt.name}] (${id}) version updated: ${targetExt.version} -> ${ext.version}`)
    ext.download_url = `https://raw.githubusercontent.com/any-listen/any-listen-extension-store/main/extensions/${id}/${path.basename(url)}`
    registry[id] = ext
    Object.assign(targetExt, buildListItem(ext))
    mergeI18nMessages(id, i18n)
  } else {
    const [ext, i18n] = await parseExtMetadata(url, null)
    if (ext.id != id) throw new Error(`Extension ID mismatch: expected [${id}], got [${ext.id}]`)
    console.log(`Extension [${id}] not found in list.json, adding`)
    ext.download_url = `https://raw.githubusercontent.com/any-listen/any-listen-extension-store/main/extensions/${id}/${path.basename(url)}`
    registry[id] = ext
    const listItem = buildListItem(ext)
    list.push(listItem)
    listMap.set(ext.id, listItem)
    mergeI18nMessages(id, i18n)
  }
}

/**
 *
 * @param {string} dir
 */
const parseExtensionDir = async (dir) => {
  const meta = path.join(dir, metaFileName)
  if (!fs.existsSync(meta)) {
    console.warn(`No meta.json found in ${dir}`)
    return
  }
  const metaContent = JSON.parse((await fs.promises.readFile(meta, 'utf-8')).toString())
  if (metaContent.version_info_url) {
    await parseVersionByInfoUrl(metaContent.id, metaContent.version_info_url)
  } else if (metaContent.package_name) {
    await parseVersionByPkgPath(metaContent.id, path.join(dir, metaContent.package_name))
  } else {
    console.warn(`No version info found for ${metaContent.id} in ${dir}`)
    return
  }
}

const run = async () => {
  fs.rmSync(path.join(dataDir, 'i18n'), { recursive: true, force: true })
  for (const name of extensionDir) {
    try {
      await parseExtensionDir(path.join(extensionsDirPath, name))
    } catch (error) {
      console.error(`Error parsing extension [${name}]:`, error)
    }
  }
  fs.writeFileSync(listPath, JSON.stringify({ all: list }, null, 2))
  for (const [name, ext] of Object.entries(registry)) {
    await fs.promises.writeFile(path.join(registryPath, `${name}.json`), JSON.stringify(ext, null, 2))
  }
  fs.mkdirSync(path.join(dataDir, 'i18n'), { recursive: true })
  for (const [lang, messages] of Object.entries(i18nMessages)) {
    await fs.promises.writeFile(path.join(dataDir, `i18n/${lang}.json`), JSON.stringify(messages, null, 2)).catch((err) => {
      console.error(`Error writing i18n file for ${lang}:`, err)
    })
  }
}

run()
