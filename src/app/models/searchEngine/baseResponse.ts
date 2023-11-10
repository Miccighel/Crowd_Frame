/*
 * This class provides an implementation for the base type of response emitted by SearchEngineBodyComponent using a <<resultEmitter>>.
 * It represents the result of the <<decodeResponse>> operation applied to a raw responses returned by one of the search engine services.
 * It is the standard interface to handle the result of queries performed to a service through SearchEngineBodyComponent.
 */
export class BaseResponse {

    /* Core parameters */
    url: string;
    name: string;
    snippet: string;

    /* Additional parameters*/
    parameters: { [key: string]: any } = {};

    constructor(
        url: string,
        name: string,
        snippet: string,
    ) {
        this.url = url;
        this.name = name;
        this.snippet = snippet;
    }

    public setParameter(parameter: string, value: any) {
        this.parameters[parameter] = value
    }

    public getParameter(parameter: string) {
        return this.parameters[parameter]
    }

}

