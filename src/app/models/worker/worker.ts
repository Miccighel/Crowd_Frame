import {WorkerSettings} from "./workerSettings";

export class Worker {

    public settings: WorkerSettings

    identifier: string;
    folder: string
    paramsFetched: Record<string, string>
    propertiesFetched: Record<string, Object>
    error: Object

    constructor(
        paramsFetched: Record<string, string>,
    ) {
        if (paramsFetched) {
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

    public getParameter(name: string) {
        return this.paramsFetched[name]
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

        if (source.toLowerCase() == 'ipify') {
            for (const [property, value] of Object.entries(propertiesData)) {
                if (!unwantedProperties.includes(property)) {
                    this.propertiesFetched[`ipify_${this.convertToSnakeCase(property)}`] = value
                }
            }
        }

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
        if (source.toLowerCase() == 'error') {
            this.error = propertiesData
        }

    }

    getIP(): Object {
         let ipData = {
            ip: null,
            source: null
        }
        if (this.propertiesFetched['cf_ip']) {
            ipData["source"] = 'cf'
            ipData["ip"] = this.propertiesFetched['cf_ip']
        } else {
            ipData["source"] = 'ipify'
            ipData["ip"] = this.propertiesFetched['ipify_ip']
        }
        return ipData
    }

    getUAG(): Object {
        let uagData = {
            uag: null,
            source: null
        }
        if (this.propertiesFetched['cf_uag']) {
            uagData["source"] = 'cf'
            uagData["uag"] = this.propertiesFetched['cf_uag']
        } else {
            if (this.propertiesFetched['ngx_user_agent']) {
                uagData["source"] = 'ngx'
                uagData["uag"] = this.propertiesFetched['ngx_user_agent']
            } else {
                uagData["source"] = 'nav'
                uagData["uag"] = this.propertiesFetched['nav_user_agent']
            }
        }
        return uagData
    }

    prettyTimeArrival(): string {
        return new Date(this.getParameter('time_arrival')).toLocaleString()
    }

    prettyTimeCompletion(): string {
        return new Date(this.getParameter('time_completion')).toLocaleString()
    }

    prettyTimeRemoval(): string {
        return new Date(this.getParameter('time_removal')).toLocaleString()
    }

    prettyTimeExpiration(): string {
        return new Date(this.getParameter('time_expiration')).toLocaleString()
    }

    convertToSnakeCase(property) {
        return property.replace(/(?:^|\.?)([A-Z])/g, function (x, y) {
            return "_" + y.toLowerCase()
        }).replace(/^_/, "")
    }

}