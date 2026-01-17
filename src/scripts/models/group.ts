import intl from "react-intl-universal"
import {
    SourceActionTypes,
    ADD_SOURCE,
    DELETE_SOURCE,
    addSource,
    RSSSource,
    SourceState,
} from "./source"
import { SourceGroup } from "../../schema-types"
import { ActionStatus, AppThunk, domParser } from "../utils"
import { saveSettings } from "./app"
import {
    fetchItemsIntermediate,
    fetchItemsRequest,
    fetchItemsSuccess,
} from "./item"

export const CREATE_SOURCE_GROUP = "CREATE_SOURCE_GROUP"
export const ADD_SOURCE_TO_GROUP = "ADD_SOURCE_TO_GROUP"
export const ADD_SOURCES_TO_GROUP = "ADD_SOURCES_TO_GROUP"
export const REMOVE_SOURCE_FROM_GROUP = "REMOVE_SOURCE_FROM_GROUP"
export const UPDATE_SOURCE_GROUP = "UPDATE_SOURCE_GROUP"
export const REORDER_SOURCE_GROUPS = "REORDER_SOURCE_GROUPS"
export const DELETE_SOURCE_GROUP = "DELETE_SOURCE_GROUP"
export const TOGGLE_GROUP_EXPANSION = "TOGGLE_GROUP_EXPANSION"

interface CreateSourceGroupAction {
    type: typeof CREATE_SOURCE_GROUP
    group: SourceGroup
}

interface AddSourceToGroupAction {
    type: typeof ADD_SOURCE_TO_GROUP
    groupIndex: number
    sid: number
}

interface AddSourcesToGroupAction {
    type: typeof ADD_SOURCES_TO_GROUP
    groupIndex: number
    sids: number[]
}

interface RemoveSourceFromGroupAction {
    type: typeof REMOVE_SOURCE_FROM_GROUP
    groupIndex: number
    sids: number[]
}

interface UpdateSourceGroupAction {
    type: typeof UPDATE_SOURCE_GROUP
    groupIndex: number
    group: SourceGroup
}

interface ReorderSourceGroupsAction {
    type: typeof REORDER_SOURCE_GROUPS
    groups: SourceGroup[]
}

interface DeleteSourceGroupAction {
    type: typeof DELETE_SOURCE_GROUP
    groupIndex: number
}

interface ToggleGroupExpansionAction {
    type: typeof TOGGLE_GROUP_EXPANSION
    groupIndex: number
}

export type SourceGroupActionTypes =
    | CreateSourceGroupAction
    | AddSourceToGroupAction
    | AddSourcesToGroupAction
    | RemoveSourceFromGroupAction
    | UpdateSourceGroupAction
    | ReorderSourceGroupsAction
    | DeleteSourceGroupAction
    | ToggleGroupExpansionAction

export function createSourceGroupDone(
    group: SourceGroup
): SourceGroupActionTypes {
    return {
        type: CREATE_SOURCE_GROUP,
        group: group,
    }
}

export function createSourceGroup(name: string): AppThunk<number> {
    return (dispatch, getState) => {
        let groups = getState().groups
        for (let i = 0; i < groups.length; i += 1) {
            const g = groups[i]
            if (g.isMultiple && g.name === name) {
                return i
            }
        }
        let group = new SourceGroup([], name)
        dispatch(createSourceGroupDone(group))
        groups = getState().groups
        window.settings.saveGroups(groups)
        return groups.length - 1
    }
}

function addSourceToGroupDone(
    groupIndex: number,
    sid: number
): SourceGroupActionTypes {
    return {
        type: ADD_SOURCE_TO_GROUP,
        groupIndex: groupIndex,
        sid: sid,
    }
}

export function addSourceToGroup(groupIndex: number, sid: number): AppThunk {
    return (dispatch, getState) => {
        dispatch(addSourceToGroupDone(groupIndex, sid))
        window.settings.saveGroups(getState().groups)
    }
}

function addSourcesToGroupDone(
    groupIndex: number,
    sids: number[]
): SourceGroupActionTypes {
    return {
        type: ADD_SOURCES_TO_GROUP,
        groupIndex: groupIndex,
        sids: sids,
    }
}

export function addSourcesToGroup(groupIndex: number, sids: number[]): AppThunk {
    return (dispatch, getState) => {
        dispatch(addSourcesToGroupDone(groupIndex, sids))
        window.settings.saveGroups(getState().groups)
    }
}

function removeSourceFromGroupDone(
    groupIndex: number,
    sids: number[]
): SourceGroupActionTypes {
    return {
        type: REMOVE_SOURCE_FROM_GROUP,
        groupIndex: groupIndex,
        sids: sids,
    }
}

export function removeSourceFromGroup(
    groupIndex: number,
    sids: number[]
): AppThunk {
    return (dispatch, getState) => {
        dispatch(removeSourceFromGroupDone(groupIndex, sids))
        window.settings.saveGroups(getState().groups)
    }
}

function deleteSourceGroupDone(groupIndex: number): SourceGroupActionTypes {
    return {
        type: DELETE_SOURCE_GROUP,
        groupIndex: groupIndex,
    }
}

export function deleteSourceGroup(groupIndex: number): AppThunk {
    return (dispatch, getState) => {
        dispatch(deleteSourceGroupDone(groupIndex))
        window.settings.saveGroups(getState().groups)
    }
}

function updateSourceGroupDone(group: SourceGroup): SourceGroupActionTypes {
    return {
        type: UPDATE_SOURCE_GROUP,
        groupIndex: group.index,
        group: group,
    }
}

export function updateSourceGroup(group: SourceGroup): AppThunk {
    return (dispatch, getState) => {
        dispatch(updateSourceGroupDone(group))
        window.settings.saveGroups(getState().groups)
    }
}

function reorderSourceGroupsDone(
    groups: SourceGroup[]
): SourceGroupActionTypes {
    return {
        type: REORDER_SOURCE_GROUPS,
        groups: groups,
    }
}

export function reorderSourceGroups(groups: SourceGroup[]): AppThunk {
    return (dispatch, getState) => {
        dispatch(reorderSourceGroupsDone(groups))
        window.settings.saveGroups(getState().groups)
    }
}

export function toggleGroupExpansion(groupIndex: number): AppThunk {
    return (dispatch, getState) => {
        dispatch({
            type: TOGGLE_GROUP_EXPANSION,
            groupIndex: groupIndex,
        })
        window.settings.saveGroups(getState().groups)
    }
}

export function fixBrokenGroups(sources: SourceState): AppThunk {
    return (dispatch, getState) => {
        const { groups } = getState()
        const sids = new Set(Object.values(sources).map(s => s.sid))
        let isBroken = false
        const newGroups: SourceGroup[] = groups
            .map(group => {
                const newGroup: SourceGroup = {
                    ...group,
                    sids: group.sids.filter(sid => sids.delete(sid)),
                }
                if (newGroup.sids.length !== group.sids.length) {
                    isBroken = true
                }
                return newGroup
            })
            .filter(group => group.isMultiple || group.sids.length > 0)
        if (isBroken || sids.size > 0) {
            for (let sid of sids) {
                newGroups.push(new SourceGroup([sid]))
            }
            dispatch(reorderSourceGroups(newGroups))
        }
    }
}

function outlineToSource(
    outline: Element
): [ReturnType<typeof addSource>, string] {
    let url = outline.getAttribute("xmlUrl")
    let name = outline.getAttribute("text") || outline.getAttribute("title")
    if (url) {
        return [addSource(url.trim(), name, true), url]
    } else {
        return null
    }
}

export function importOPML(): AppThunk {
    return async (dispatch, getState) => {
        const filters = [
            { name: intl.get("sources.opmlFile"), extensions: ["xml", "opml"] },
        ]
        window.utils.showOpenDialog(filters).then(data => {
            if (data) {
                dispatch(saveSettings())
                let doc = domParser
                    .parseFromString(data, "text/xml")
                    .getElementsByTagName("body")
                if (doc.length == 0) {
                    dispatch(saveSettings())
                    return
                }
                let parseError = doc[0].getElementsByTagName("parsererror")
                if (parseError.length > 0) {
                    dispatch(saveSettings())
                    window.utils.showErrorBox(
                        intl.get("sources.errorParse"),
                        intl.get("sources.errorParseHint")
                    )
                    return
                }
                let sources: [ReturnType<typeof addSource>, number, string][] =
                    []
                let errors: [string, any][] = []
                let sourceGroupMoves: [number, number][] = [] // [sid, newGid] where -1 means ungrouped
                
                // Build a map of existing URLs to source objects for efficient lookup
                const existingSourceMap = new Map<string, RSSSource>()
                Object.values(getState().sources).forEach(s => {
                    existingSourceMap.set(s.url, s)
                })
                
                // Build a map of current group assignments: url -> groupIndex
                // -1 means ungrouped (single source in non-multiple group)
                const currentGroupMap = new Map<string, number>()
                getState().groups.forEach((group, groupIndex) => {
                    group.sids.forEach(sid => {
                        const source = getState().sources[sid]
                        if (source) {
                            // Store groupIndex for multiple groups, -1 for single-source groups
                            currentGroupMap.set(source.url, group.isMultiple ? groupIndex : -1)
                        }
                    })
                })
                
                const importedUrls = new Set<string>()
                
                for (let el of doc[0].children) {
                    if (el.getAttribute("type") === "rss") {
                        let source = outlineToSource(el)
                        if (source) {
                            const url = source[1]
                            const existingSource = existingSourceMap.get(url)
                            if (existingSource) {
                                // OPML中未分组 (gid = -1)
                                const currentGid = currentGroupMap.get(url)
                                // 规则1: 本地未分组 + OPML未分组 → 跳过
                                // 规则2: 本地在分组 + OPML未分组 → 跳过
                                // 两种情况都是跳过，不做任何操作
                            } else if (importedUrls.has(url)) {
                            } else {
                                importedUrls.add(url)
                                sources.push([source[0], -1, url])
                            }
                        }
                    } else if (
                        el.hasAttribute("text") ||
                        el.hasAttribute("title")
                    ) {
                        let groupName =
                            el.getAttribute("text") || el.getAttribute("title")
                        let gid = dispatch(createSourceGroup(groupName))
                        for (let child of el.children) {
                            let source = outlineToSource(child)
                            if (source) {
                                const url = source[1]
                                const existingSource = existingSourceMap.get(url)
                                if (existingSource) {
                                    // OPML中在分组内
                                    const currentGid = currentGroupMap.get(url)
                                    if (currentGid === undefined || currentGid === -1) {
                                        // 规则3: 本地未分组 + OPML在分组 → 移动到OPML分组
                                        sourceGroupMoves.push([existingSource.sid, gid])
                                    } else if (currentGid !== gid) {
                                        // 规则4: 本地在分组A + OPML在分组B (A≠B) → 移动到OPML分组
                                        sourceGroupMoves.push([existingSource.sid, gid])
                                    } else {
                                        // 规则5: 本地在分组A + OPML在分组A (相同) → 跳过
                                    }
                                } else if (importedUrls.has(url)) {
                                } else {
                                    importedUrls.add(url)
                                    sources.push([source[0], gid, url])
                                }
                            }
                        }
                    }
                }
                
                // Move existing sources to their new groups
                if (sourceGroupMoves.length > 0) {
                    let updatedGroups = getState().groups.map(g => ({ ...g, sids: [...g.sids] }))
                    
                    for (let [sid, newGid] of sourceGroupMoves) {
                        // Remove from current group
                        for (let i = 0; i < updatedGroups.length; i++) {
                            const group = updatedGroups[i]
                            if (group.sids.includes(sid)) {
                                group.sids = group.sids.filter(s => s !== sid)
                                break
                            }
                        }
                        
                        // Add to target group
                        updatedGroups[newGid].sids.push(sid)
                    }
                    
                    // Remove empty non-multiple groups
                    updatedGroups = updatedGroups.filter(g => g.isMultiple || g.sids.length > 0)
                    
                    // Dispatch once with all changes
                    dispatch(reorderSourceGroups(updatedGroups))
                }
                
                if (sources.length === 0) {
                    dispatch(saveSettings())
                    return
                }
                
                dispatch(fetchItemsRequest(sources.length))
                let promises = sources.map(([s, gid, url]) => {
                    return dispatch(s)
                        .then(sid => {
                            if (sid !== null && gid > -1)
                                dispatch(addSourceToGroup(gid, sid))
                        })
                        .catch(err => {
                            errors.push([url, err])
                        })
                        .finally(() => {
                            dispatch(fetchItemsIntermediate())
                        })
                })
                Promise.allSettled(promises).then(() => {
                    dispatch(fetchItemsSuccess([], {}))
                    dispatch(saveSettings())
                    if (errors.length > 0) {
                        window.utils.showErrorBox(
                            intl.get("sources.errorImport", {
                                count: errors.length,
                            }),
                            errors
                                .map(e => {
                                    return e[0] + "\n" + String(e[1])
                                })
                                .join("\n"),
                            intl.get("context.copy")
                        )
                    }
                })
            }
        })
    }
}

function sourceToOutline(source: RSSSource, xml: Document) {
    let outline = xml.createElement("outline")
    outline.setAttribute("text", source.name)
    outline.setAttribute("title", source.name)
    outline.setAttribute("type", "rss")
    outline.setAttribute("xmlUrl", source.url)
    return outline
}

export function exportOPML(): AppThunk {
    return (_, getState) => {
        const filters = [
            { name: intl.get("sources.opmlFile"), extensions: ["opml"] },
        ]
        window.utils
            .showSaveDialog(filters, "*/Fluent_Reader_Export.opml")
            .then(write => {
                if (write) {
                    let state = getState()
                    let xml = domParser.parseFromString(
                        '<?xml version="1.0" encoding="UTF-8"?><opml version="1.0"><head><title>Fluent Reader Export</title></head><body></body></opml>',
                        "text/xml"
                    )
                    let body = xml.getElementsByTagName("body")[0]
                    for (let group of state.groups) {
                        if (group.isMultiple) {
                            let outline = xml.createElement("outline")
                            outline.setAttribute("text", group.name)
                            outline.setAttribute("title", group.name)
                            for (let sid of group.sids) {
                                outline.appendChild(
                                    sourceToOutline(state.sources[sid], xml)
                                )
                            }
                            body.appendChild(outline)
                        } else {
                            body.appendChild(
                                sourceToOutline(
                                    state.sources[group.sids[0]],
                                    xml
                                )
                            )
                        }
                    }
                    let serializer = new XMLSerializer()
                    write(
                        serializer.serializeToString(xml),
                        intl.get("settings.writeError")
                    )
                }
            })
    }
}

export type GroupState = SourceGroup[]

export function groupReducer(
    state = window.settings.loadGroups(),
    action: SourceActionTypes | SourceGroupActionTypes
): GroupState {
    switch (action.type) {
        case ADD_SOURCE:
            switch (action.status) {
                case ActionStatus.Success:
                    return [...state, new SourceGroup([action.source.sid])]
                default:
                    return state
            }
        case DELETE_SOURCE:
            return [
                ...state
                    .map(group => ({
                        ...group,
                        sids: group.sids.filter(
                            sid => sid != action.source.sid
                        ),
                    }))
                    .filter(g => g.isMultiple || g.sids.length == 1),
            ]
        case CREATE_SOURCE_GROUP:
            return [...state, action.group]
        case ADD_SOURCE_TO_GROUP:
            return state
                .map((g, i) => ({
                    ...g,
                    sids:
                        i == action.groupIndex
                            ? [
                                  ...g.sids.filter(sid => sid !== action.sid),
                                  action.sid,
                              ]
                            : g.sids.filter(sid => sid !== action.sid),
                }))
                .filter(g => g.isMultiple || g.sids.length > 0)
        case ADD_SOURCES_TO_GROUP:
            const sidsToAdd = new Set(action.sids);
            return state
                .map((g, i) => {
                    if (i === action.groupIndex) {
                        // For the target group, add the new sids, avoiding duplicates
                        const newSids = new Set([...g.sids, ...action.sids]);
                        return { ...g, sids: Array.from(newSids) };
                    } else {
                        // For other groups, filter out the sids that are being moved
                        return { ...g, sids: g.sids.filter(sid => !sidsToAdd.has(sid)) };
                    }
                })
                .filter(g => g.isMultiple || g.sids.length > 0);
        case REMOVE_SOURCE_FROM_GROUP:
            return [
                ...state.slice(0, action.groupIndex),
                {
                    ...state[action.groupIndex],
                    sids: state[action.groupIndex].sids.filter(
                        sid => !action.sids.includes(sid)
                    ),
                },
                ...action.sids.map(sid => new SourceGroup([sid])),
                ...state.slice(action.groupIndex + 1),
            ]
        case UPDATE_SOURCE_GROUP:
            return [
                ...state.slice(0, action.groupIndex),
                action.group,
                ...state.slice(action.groupIndex + 1),
            ]
        case REORDER_SOURCE_GROUPS:
            return action.groups
        case DELETE_SOURCE_GROUP:
            return [
                ...state.slice(0, action.groupIndex),
                ...state[action.groupIndex].sids.map(
                    sid => new SourceGroup([sid])
                ),
                ...state.slice(action.groupIndex + 1),
            ]
        case TOGGLE_GROUP_EXPANSION:
            return state.map((g, i) =>
                i == action.groupIndex
                    ? {
                          ...g,
                          expanded: !g.expanded,
                      }
                    : g
            )
        default:
            return state
    }
}
