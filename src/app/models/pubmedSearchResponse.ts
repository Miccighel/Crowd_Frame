export interface PubmedSearchResponse {
    header: Object;
    esearchresult: ESearchResult;
}

export interface ESearchResult {
    count: string;
    retmax: string;
    retstart: string;
    querykey: string;
    webenv: string;
    idlist: Array<string>;
    translationset: Array<Object>;
    translationstack: Array<Object>;
    querytranslation:string;
}
