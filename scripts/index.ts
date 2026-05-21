import fs from 'node:fs'
import path from 'node:path'
import { dataDir, checkDownloadUrl, getVersionInfo, parseExtMetadata } from './utils.ts'

const metaFileName = 'meta.json'

const listPath = path.join(dataDir, 'list.json')
const list = JSON.parse(fs.readFileSync(listPath, 'utf-8').toString()).all
const listMap = new Map<string, AnyListen.Store.ExtensionListItem>()
const i18nMessages: AnyListen.Store.I18nMessages = {}
for (const ext of list) listMap.set(ext.id, ext)
for (const lang of fs.readdirSync(path.join(import.meta.dirname, '../i18n'))) {
  const langPath = path.join(import.meta.dirname, '../i18n', lang)
  const messages = JSON.parse(fs.readFileSync(langPath, 'utf-8').toString())
  i18nMessages[lang.replace('.json', '')] = messages
}

const registry: Record<string, AnyListen.Store.ExtensionRegistryItem> = {}
const oldRegistry: Record<string, AnyListen.Store.ExtensionRegistryItem> = {}
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

const oldI18nMessages: AnyListen.Store.I18nMessages = {}
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

const geti18nMessageKeys = (ext: AnyListen.Extension.Manifest) => {
  const i18nMessageKeys = ['{description}']
  if (ext.contributes) {
    if (ext.contributes.commands) {
      for (const cmd of ext.contributes.commands) {
        i18nMessageKeys.push(cmd.name)
      }
    }
    if (ext.contributes.settings) {
      for (const setting of ext.contributes.settings) {
        i18nMessageKeys.push(setting.name)
        if (setting.description) i18nMessageKeys.push(setting.description)
      }
    }
    if (ext.contributes.resource) {
      for (const resource of ext.contributes.resource) {
        i18nMessageKeys.push(resource.name)
      }
    }
    if (ext.contributes.listProviders) {
      for (const provider of ext.contributes.listProviders) {
        i18nMessageKeys.push(provider.name)
        if (provider.description) i18nMessageKeys.push(provider.description)
      }
    }
  }

  return i18nMessageKeys.map((key) => key.replace(/{([\w-.]+)}/g, '$1'))
}
const mergeI18nMessages = (ext: AnyListen.Extension.Manifest, i18n: AnyListen.Store.I18nMessages) => {
  const id = ext.id
  for (const [lang, msgs] of Object.entries(i18n)) {
    let messages = i18nMessages[lang]
    if (!messages) messages = i18nMessages[lang] = {}
    for (const key of geti18nMessageKeys(ext)) {
      if (!msgs[key]) continue
      messages[`${id}.${key}`] = msgs[key]
    }
  }
}
const cpI18nMessages = (id: string) => {
  for (const [langs, messages] of Object.entries(oldI18nMessages)) {
    if (!Object.keys(messages).some((key) => key.startsWith(`${id}.`))) continue
    if (!i18nMessages[langs]) i18nMessages[langs] = {}
    for (const [key, value] of Object.entries(messages)) {
      if (!key.startsWith(`${id}.`)) continue
      i18nMessages[langs][key] = value
    }
  }
}
const buildListItem = (
  ext: AnyListen.Extension.Manifest,
  download_url: string,
  sha256: string,
  create_timestamp: number,
  update_timestamp: number
): AnyListen.Store.ExtensionListItem => {
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
    download_url,
    sha256,
    create_timestamp,
    update_timestamp,
  }
}
const formatDate = (date: Date) => {
  const d = new Date(date).getTime()
  return isNaN(d) ? Date.now() : d
}
const parseVersionByInfoUrl = async (id: string, url: string) => {
  const versionInfo = await getVersionInfo(url)
  if (!versionInfo.version) throw new Error(`Version info not found for [${id}] at ${url}`)
  if (!versionInfo.download_url) throw new Error(`Download URL not found for [${id}] at ${url}`)
  const targetExt = listMap.get(id)
  const updateTimestamp = versionInfo.date ? formatDate(versionInfo.date) : Date.now()
  if (targetExt) {
    if (targetExt.version === versionInfo.version) {
      cpI18nMessages(id)
      registry[id] = oldRegistry[id]
      if (await checkDownloadUrl(registry[id].download_url)) return
    }
    console.log(`Extension [${targetExt.name}] (${id}) version updated: ${targetExt.version} -> ${versionInfo.version}`)
    const [ext, i18n, sha256] = await parseExtMetadata(versionInfo.download_url, targetExt.publicKey)
    if (ext.id != id) throw new Error(`Extension ID mismatch: expected [${id}], got [${ext.id}]`)
    registry[id] = {
      ...ext,
      download_url: versionInfo.download_url,
      sha256,
      create_timestamp: targetExt.create_timestamp || updateTimestamp,
      update_timestamp: updateTimestamp,
    }
    Object.assign(
      targetExt,
      buildListItem(ext, versionInfo.download_url, sha256, targetExt.create_timestamp || updateTimestamp, updateTimestamp)
    )
    mergeI18nMessages(ext, i18n)
  } else {
    console.log(`Extension [${id}] not exist in list.json, adding`)
    const [ext, i18n, sha256] = await parseExtMetadata(versionInfo.download_url)
    if (ext.id != id) throw new Error(`Extension ID mismatch: expected [${id}], got [${ext.id}]`)
    const listItem = buildListItem(ext, versionInfo.download_url, sha256, updateTimestamp, updateTimestamp)
    registry[id] = {
      ...ext,
      download_url: versionInfo.download_url,
      sha256,
      create_timestamp: updateTimestamp,
      update_timestamp: updateTimestamp,
    }
    list.push(listItem)
    listMap.set(ext.id, listItem)
    mergeI18nMessages(ext, i18n)
  }
}

const parseVersionByPkgPath = async (id: string, url: string) => {
  const targetExt = listMap.get(id)
  const updateTimestamp = Date.now()
  if (targetExt) {
    const [ext, i18n, sha256] = await parseExtMetadata(url, targetExt.publicKey)
    if (ext.id != id) throw new Error(`Extension ID mismatch: expected [${id}], got [${ext.id}]`)
    if (targetExt.version === ext.version) {
      cpI18nMessages(id)
      registry[id] = oldRegistry[id]
      return
    }
    console.log(`Extension [${targetExt.name}] (${id}) version updated: ${targetExt.version} -> ${ext.version}`)
    const download_url = `https://raw.githubusercontent.com/any-listen/any-listen-extension-store/main/extensions/${id}/${path.basename(url)}`
    registry[id] = {
      ...ext,
      download_url,
      sha256,
      update_timestamp: updateTimestamp,
      create_timestamp: targetExt.create_timestamp || updateTimestamp,
    }
    Object.assign(
      targetExt,
      buildListItem(ext, download_url, sha256, targetExt.create_timestamp || updateTimestamp, updateTimestamp)
    )
    mergeI18nMessages(ext, i18n)
  } else {
    const [ext, i18n, sha256] = await parseExtMetadata(url)
    if (ext.id != id) throw new Error(`Extension ID mismatch: expected [${id}], got [${ext.id}]`)
    console.log(`Extension [${id}] not found in list.json, adding`)
    const download_url = `https://raw.githubusercontent.com/any-listen/any-listen-extension-store/main/extensions/${id}/${path.basename(url)}`
    registry[id] = { ...ext, download_url, sha256, update_timestamp: updateTimestamp, create_timestamp: updateTimestamp }
    const listItem = buildListItem(ext, download_url, sha256, updateTimestamp, updateTimestamp)
    list.push(listItem)
    listMap.set(ext.id, listItem)
    mergeI18nMessages(ext, i18n)
  }
}

/**
 *
 */
const parseExtensionDir = async (dir: string) => {
  const meta = path.join(dir, metaFileName)
  if (!fs.existsSync(meta)) {
    console.warn(`No meta.json found in ${dir}`)
    return
  }
  const metaContent = JSON.parse((await fs.promises.readFile(meta, 'utf-8')).toString()) as AnyListen.Store.MetaInfo
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
