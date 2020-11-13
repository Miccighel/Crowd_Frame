/*
 * This class provides...
 */
export class Worker {

  identifier: string;
  properties: Object;
  folder: string

  constructor(
    mturkId: string,
    folder: string,
    cloudflareData: string,
    navigator: Navigator
  ) {
    this.identifier = mturkId
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
    if(cloudflareData!=null)
    for (let property of cloudflareData.split(/\n/)) {
      if (property.length > 0 && !unwantedProperties.includes(property)) {
        properties[property.split("=")[0]] = property.split("=")[1]
      }
    }
    for (let property in navigator) {
      if(!unwantedProperties.includes(property)) {
        let str = navigator[property];
        if (str && str.length > 0) {
          properties[property] = str
        }
      }
    }
    this.properties = properties
    this.folder = folder

  }

}
