import * as React from "react"
import intl from "react-intl-universal"
import { ServiceConfigsTabProps } from "../service"
import {
    WebDAVConfigs,
    getWebDAVFileUrl,
    validateWebDAVConfigs,
} from "../../../scripts/models/services/webdav"
import { SyncService } from "../../../schema-types"
import {
    Stack,
    Icon,
    Label,
    TextField,
    PrimaryButton,
    DefaultButton,
    Toggle,
    MessageBar,
    MessageBarType,
} from "@fluentui/react"
import DangerButton from "../../utils/danger-button"
import { urlTest } from "../../../scripts/utils"

type WebDAVConfigsTabState = {
    existing: boolean
    endpoint: string
    username: string
    password: string
    opmlPath: string
    enabled: boolean
    checking: boolean
    checkResult: "success" | "failure" | null
    checkError: string
}

class WebDAVConfigsTab extends React.Component<
    ServiceConfigsTabProps,
    WebDAVConfigsTabState
> {
    constructor(props: ServiceConfigsTabProps) {
        super(props)
        const configs = props.configs as WebDAVConfigs
        this.state = {
            existing: configs.type === SyncService.WebDAV,
            endpoint: configs.endpoint || "https://example.com/dav/",
            username: configs.username || "",
            password: "",
            opmlPath: configs.opmlPath || "subscriptions.opml",
            enabled: configs.enabled !== false,
            checking: false,
            checkResult: null,
            checkError: "",
        }
    }

    handleInputChange = event => {
        const name: string = event.target.name
        // @ts-expect-error
        this.setState({ [name]: event.target.value, checkResult: null })
    }

    validateForm = () => {
        return (
            urlTest(this.state.endpoint.trim()) &&
            this.state.opmlPath.trim().length > 0 &&
            (this.state.existing ||
                !this.state.enabled ||
                (this.state.username && this.state.password))
        )
    }

    getConfigs = (): WebDAVConfigs => {
        let configs: WebDAVConfigs
        if (this.state.existing) {
            configs = {
                ...this.props.configs,
                endpoint: this.state.endpoint.trim(),
                username: this.state.username,
                opmlPath: this.state.opmlPath.trim(),
                enabled: this.state.enabled,
            } as WebDAVConfigs
            if (this.state.password) configs.password = this.state.password
        } else {
            configs = {
                type: SyncService.WebDAV,
                endpoint: this.state.endpoint.trim(),
                username: this.state.username,
                password: this.state.password,
                opmlPath: this.state.opmlPath.trim(),
                enabled: this.state.enabled,
            }
        }
        return configs
    }

    checkConnection = async () => {
        this.setState({ checking: true, checkResult: null })
        try {
            await validateWebDAVConfigs(this.getConfigs())
            this.setState({
                checking: false,
                checkResult: "success",
                checkError: "",
            })
        } catch (err) {
            this.setState({
                checking: false,
                checkResult: "failure",
                checkError: String(err),
            })
        }
    }

    save = async () => {
        const configs = this.getConfigs()
        this.props.blockActions()
        try {
            if (configs.enabled) await validateWebDAVConfigs(configs)
        } catch (err) {
            this.props.blockActions()
            window.utils.showErrorBox(
                intl.get("service.failure"),
                getWebDAVFileUrl(configs) + "\n" + String(err)
            )
            return
        }
        this.props.save(configs)
        this.setState({ existing: true })
        this.props.sync()
    }

    remove = async () => {
        this.props.exit()
        await this.props.remove()
    }

    render() {
        return (
            <Stack horizontalAlign="center" style={{ marginTop: 48 }}>
                <Icon
                    iconName="Cloud"
                    style={{
                        color: "var(--black)",
                        fontSize: 32,
                        userSelect: "none",
                    }}
                />
                <Label style={{ margin: "8px 0 36px" }}>WebDAV</Label>
                <Stack className="login-form" horizontal>
                    <Stack.Item>
                        <Label>{intl.get("service.endpoint")}</Label>
                    </Stack.Item>
                    <Stack.Item grow>
                        <TextField
                            onGetErrorMessage={v =>
                                urlTest(v.trim())
                                    ? ""
                                    : intl.get("sources.badUrl")
                            }
                            validateOnLoad={false}
                            name="endpoint"
                            value={this.state.endpoint}
                            onChange={this.handleInputChange}
                        />
                    </Stack.Item>
                </Stack>
                <Stack className="login-form" horizontal>
                    <Stack.Item>
                        <Label>{intl.get("service.username")}</Label>
                    </Stack.Item>
                    <Stack.Item grow>
                        <TextField
                            name="username"
                            value={this.state.username}
                            onChange={this.handleInputChange}
                        />
                    </Stack.Item>
                </Stack>
                <Stack className="login-form" horizontal>
                    <Stack.Item>
                        <Label>{intl.get("service.password")}</Label>
                    </Stack.Item>
                    <Stack.Item grow>
                        <TextField
                            type="password"
                            placeholder={
                                this.state.existing
                                    ? intl.get("service.unchanged")
                                    : ""
                            }
                            name="password"
                            value={this.state.password}
                            onChange={this.handleInputChange}
                        />
                    </Stack.Item>
                </Stack>
                <Stack className="login-form" horizontal>
                    <Stack.Item>
                        <Label>{intl.get("service.opmlPath")}</Label>
                    </Stack.Item>
                    <Stack.Item grow>
                        <TextField
                            onGetErrorMessage={v =>
                                v.trim().length > 0 ? "" : intl.get("emptyField")
                            }
                            validateOnLoad={false}
                            name="opmlPath"
                            value={this.state.opmlPath}
                            onChange={this.handleInputChange}
                        />
                    </Stack.Item>
                </Stack>
                <Stack className="login-form" horizontal verticalAlign="center">
                    <Stack.Item grow>
                        <Label>{intl.get("service.enabled")}</Label>
                    </Stack.Item>
                    <Stack.Item>
                        <Toggle
                            checked={this.state.enabled}
                            onChange={(_, checked) =>
                                this.setState({
                                    enabled: checked,
                                    checkResult: null,
                                })
                            }
                        />
                    </Stack.Item>
                </Stack>
                {this.state.checkResult === "success" && (
                    <MessageBar messageBarType={MessageBarType.success}>
                        {intl.get("service.connectionAvailable")}
                    </MessageBar>
                )}
                {this.state.checkResult === "failure" && (
                    <MessageBar messageBarType={MessageBarType.error}>
                        {intl.get("service.failureHint")}
                        <br />
                        {getWebDAVFileUrl(this.getConfigs())}
                        <br />
                        {this.state.checkError}
                    </MessageBar>
                )}
                <Stack horizontal style={{ marginTop: 32 }}>
                    <Stack.Item>
                        <PrimaryButton
                            disabled={!this.validateForm()}
                            onClick={this.save}
                            text={
                                this.state.existing
                                    ? intl.get("edit")
                                    : intl.get("confirm")
                            }
                        />
                    </Stack.Item>
                    <Stack.Item>
                        <DefaultButton
                            disabled={
                                !this.validateForm() || this.state.checking
                            }
                            onClick={this.checkConnection}
                            text={
                                this.state.checking
                                    ? intl.get("service.checking")
                                    : intl.get("service.testConnection")
                            }
                        />
                    </Stack.Item>
                    <Stack.Item>
                        {this.state.existing ? (
                            <DangerButton
                                onClick={this.remove}
                                text={intl.get("delete")}
                            />
                        ) : (
                            <DefaultButton
                                onClick={this.props.exit}
                                text={intl.get("cancel")}
                            />
                        )}
                    </Stack.Item>
                </Stack>
            </Stack>
        )
    }
}

export default WebDAVConfigsTab
