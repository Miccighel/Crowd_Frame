/*
 * This interface provides a representation of the raw response returned by a request to eSearch API of Pubmed
 * Documentation:
 * https://www.ncbi.nlm.nih.gov/books/NBK25499/#chapter4.ESearch
 */
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
