export class Worker {

  identifier: string;
  folder: string
  cloudflareProperties: Object;
  navigatorProperties: Object;
  ngxDeviceDetectorProperties: Object;

  constructor(
    mturkId: string,
    folder: string,
    cloudflareData: string,
    navigator: Navigator,
    ngxDeviceDetectorData: Object,
  ) {

    this.identifier = mturkId
    this.folder = folder
    let unwantedProperties = [
      "registerProtocolHandler",
      "requestMediaKeySystemAccess",
      "sendBeacon",
      "unregisterProtocolHandler",
      "vibrate",
      "getUserMedia",
      "webkitGetUserMedia"
    ]
    let properties = {}
    if (cloudflareData != null)
      for (let property of cloudflareData.split(/\n/)) {
        if (property.length > 0 && !unwantedProperties.includes(property)) {
          properties[property.split("=")[0]] = property.split("=")[1]
        }
      }
    this.cloudflareProperties = properties
    properties = {}
    for (let property in navigator) {
      if (!unwantedProperties.includes(property)) {
        let str = navigator[property];
        if (str && str.length > 0) {
          properties[property] = str
        }
      }
    }

    this.navigatorProperties = properties
    this.ngxDeviceDetectorProperties = ngxDeviceDetectorData

  }

}
