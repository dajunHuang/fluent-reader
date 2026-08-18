import intl from "react-intl-universal"
import { ServiceConfigs, SourceGroup, SyncService } from "../../../schema-types"
import { ServiceHooks } from "../service"
import {
    RSSSource,
    addSourceSuccess,
    deleteSource,
    insertSource,
    updateFavicon,
    updateSource,
} from "../source"
import { reorderSourceGroups } from "../group"
import { domParser, AppThunk } from "../../utils"

export interface WebDAVConfigs extends ServiceConfigs {
    type: SyncService.WebDAV
    endpoint: string
    username: string
    password: string
    opmlPath: string
    enabled: boolean
}

type RemoteSource = {
    url: string
    name: string
    groupName?: string
}

function trimSlashEnd(value: string) {
    return value.replace(/\/+$/, "")
}

function trimSlashStart(value: string) {
    return value.replace(/^\/+/, "")
}

export function getWebDAVFileUrl(configs: WebDAVConfigs) {
    const path = configs.opmlPath.trim()
    try {
        if (/^https?:\/\//i.test(path)) return new URL(path).toString()
        return new URL(
            trimSlashStart(path),
            trimSlashEnd(configs.endpoint.trim()) + "/"
        ).toString()
    } catch {
        if (/^https?:\/\//i.test(path)) return path
        return (
            trimSlashEnd(configs.endpoint.trim()) + "/" + trimSlashStart(path)
        )
    }
}

async function fetchRemoteOPML(configs: WebDAVConfigs) {
    const headers: Record<string, string> = {}
    headers["Cache-Control"] = "no-cache"
    headers["Pragma"] = "no-cache"
    if (configs.username || configs.password) {
        headers["Authorization"] =
            "Basic " + btoa(configs.username + ":" + configs.password)
    }
    return await window.utils.fetchText(getWebDAVFileUrl(configs), false, {
        method: "GET",
        headers: headers,
        cache: "no-store",
    })
}

export async function validateWebDAVConfigs(configs: WebDAVConfigs) {
    parseOPMLSources(await fetchRemoteOPML(configs))
}

function getOutlineName(outline: Element) {
    return (
        outline.getAttribute("text") ||
        outline.getAttribute("title") ||
        ""
    ).trim()
}

function getOutlineUrl(outline: Element) {
    return (
        outline.getAttribute("xmlUrl") ||
        outline.getAttribute("xmlurl") ||
        outline.getAttribute("url") ||
        ""
    ).trim()
}

export function parseOPMLSources(data: string): RemoteSource[] {
    const xml = domParser.parseFromString(data, "text/xml")
    if (xml.getElementsByTagName("parsererror").length > 0) {
        throw new Error(intl.get("sources.errorParse"))
    }
    const bodies = xml.getElementsByTagName("body")
    if (bodies.length === 0) throw new Error(intl.get("sources.errorParse"))

    const sources = new Array<RemoteSource>()
    const seen = new Set<string>()
    const visit = (parent: Element, groupName?: string) => {
        for (let outline of Array.from(parent.children)) {
            const url = getOutlineUrl(outline)
            if (url) {
                const normalizedUrl = url.trim()
                if (!seen.has(normalizedUrl)) {
                    seen.add(normalizedUrl)
                    sources.push({
                        url: normalizedUrl,
                        name: getOutlineName(outline),
                        groupName: groupName,
                    })
                }
            } else {
                const name = getOutlineName(outline)
                visit(outline, name || groupName)
            }
        }
    }
    visit(bodies[0])
    return sources
}

function existingGroupMap(groups: SourceGroup[]) {
    const map = new Map<string, SourceGroup>()
    for (let group of groups) {
        if (group.isMultiple && group.name) map.set(group.name, group)
    }
    return map
}

function syncRemoteSources(
    remoteSources: RemoteSource[]
): AppThunk<Promise<void>> {
    return async (dispatch, getState) => {
        const state = getState()
        const existingByUrl = new Map<string, RSSSource>()
        for (let source of Object.values(state.sources)) {
            existingByUrl.set(source.url.trim(), source)
        }

        const remoteUrls = new Set(remoteSources.map(source => source.url))
        for (let source of Object.values(state.sources)) {
            if (!remoteUrls.has(source.url.trim())) {
                await dispatch(deleteSource(source, true))
            }
        }

        const sidByUrl = new Map<string, number>()
        const faviconSids = new Array<number>()
        for (let remote of remoteSources) {
            const existing = existingByUrl.get(remote.url)
            if (existing) {
                sidByUrl.set(remote.url, existing.sid)
                if (remote.name && existing.name !== remote.name) {
                    await dispatch(
                        updateSource({
                            ...existing,
                            name: remote.name,
                        } as RSSSource)
                    )
                }
            } else {
                const source = new RSSSource(
                    remote.url,
                    remote.name || intl.get("sources.untitled")
                )
                const inserted = await dispatch(insertSource(source))
                inserted.unreadCount = 0
                dispatch(addSourceSuccess(inserted, false))
                sidByUrl.set(remote.url, inserted.sid)
                faviconSids.push(inserted.sid)
            }
        }

        const previousGroups = existingGroupMap(getState().groups)
        const nextGroups = new Array<SourceGroup>()
        const groupByName = new Map<string, SourceGroup>()
        for (let remote of remoteSources) {
            const sid = sidByUrl.get(remote.url)
            if (sid === undefined) continue
            if (remote.groupName) {
                let group = groupByName.get(remote.groupName)
                if (!group) {
                    const previous = previousGroups.get(remote.groupName)
                    group = {
                        isMultiple: true,
                        name: remote.groupName,
                        expanded: previous ? previous.expanded : true,
                        sids: [],
                    }
                    groupByName.set(remote.groupName, group)
                    nextGroups.push(group)
                }
                group.sids.push(sid)
            } else {
                nextGroups.push(new SourceGroup([sid]))
            }
        }
        dispatch(reorderSourceGroups(nextGroups))
        window.settings.saveGroups(getState().groups)
        if (faviconSids.length > 0) dispatch(updateFavicon(faviconSids))
    }
}

export const webdavServiceHooks: ServiceHooks = {
    authenticate: async (configs: WebDAVConfigs) => {
        try {
            await validateWebDAVConfigs(configs)
            return true
        } catch (err) {
            console.log(err)
            return false
        }
    },

    syncSources: () => async (dispatch, getState) => {
        const configs = getState().service as WebDAVConfigs
        if (!configs.enabled) return
        const remoteSources = parseOPMLSources(await fetchRemoteOPML(configs))
        await dispatch(syncRemoteSources(remoteSources))
    },
}
