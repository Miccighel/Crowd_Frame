export class BaseResponse {

    url: string;
    name: string;
    snippet: string;

    constructor(
        url: string,
        name: string,
        snippet: string,
    ) {
        this.url = url;
        this.name = name;
        this.snippet = snippet;
    }

}

