import {SettingsWorker} from "./settingsWorker";

export class Worker {

    public settings: SettingsWorker

    identifier: string;
    folder: string
    paramsFetched: Record<string, string>
    propertiesFetched: Record<string, Object>

    constructor(
        paramsFetched: Record<string, string>,
    ) {
        if(paramsFetched) {
            this.paramsFetched = paramsFetched
        } else {
            this.paramsFetched = {}
        }
        for (const [param, value] of Object.entries(this.paramsFetched)) {
            if (param.toLowerCase().includes('identifier')) {
                this.identifier = value
            }
        }
        this.propertiesFetched = {}
    }

    public setParameter(name: string, value: any) {
        this.paramsFetched[name] = value
    }
    public updateProperties(source: string, propertiesData: any) {

        let unwantedProperties = [
            "registerProtocolHandler",
            "requestMediaKeySystemAccess",
            "sendBeacon",
            "plugins",
            "presentation",
            "unregisterProtocolHandler",
            "vibrate",
            "getUserMedia",
            "webkitGetUserMedia",
            "hid",
            "bluetooth",
            "clipboard",
            "credentials",
            "languages",
            "locks",
            "managed",
            "mediaCapabilities",
            "mediaDevices",
            "mediaSession",
            "mimeTypes",
            "permissions",
            "serviceWorker",
            "scheduling",
            "serial",
            "usb",
            "userActivation",
            "userAgentData",
            "virtualKeyboard",
            "wakeLock",
            "webkitPersistentStorage",
            "webkitTemporaryStorage",
            "xr"
        ]

        if (source.toLowerCase() == 'cloudflare') {
            for (let property of (propertiesData).toString().split(/\n/)) {
                if (property.length > 0 && !unwantedProperties.includes(property)) {
                    this.propertiesFetched[`cf_${this.convertToSnakeCase(property.split("=")[0])}`] = property.split("=")[1]
                }
            }
        }
        if (source.toLowerCase() == 'navigator') {
            propertiesData = propertiesData as Navigator
            for (let property in propertiesData) {
                if (!unwantedProperties.includes(property)) {
                    let data = propertiesData[property]
                    if (typeof data != "function") {
                        if (typeof data == "object") {
                            for (let propertySub in data) {
                                let dataSub = propertiesData[property][propertySub]
                                if (typeof dataSub != "function") {
                                    if (!(propertySub.includes('zone_symbol'))) {
                                        this.propertiesFetched[`nav_${this.convertToSnakeCase(property.split("=")[0])}_${this.convertToSnakeCase(propertySub.split("=")[0])}`] = dataSub
                                    }
                                }
                            }
                        } else {
                            if (!(property.includes('zone_symbol'))) {
                                this.propertiesFetched[`nav_${this.convertToSnakeCase(property.split("=")[0])}`] = propertiesData[property]
                            }
                        }
                    }
                }
            }
        }
        if (source.toLowerCase() == 'ngxdevicedetector') {
            for (const [property, value] of Object.entries(propertiesData)) {
                if (!unwantedProperties.includes(property)) {
                    this.propertiesFetched[`ngx_${this.convertToSnakeCase(property)}`] = value
                }
            }
        }
    }

    convertToSnakeCase(property) {
        return property.replace(/(?:^|\.?)([A-Z])/g, function (x, y) {
            return "_" + y.toLowerCase()
        }).replace(/^_/, "")
    }

}