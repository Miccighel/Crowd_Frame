/*
 * Interfaces for the raw response returned by a request to the PubMed eSearch API.
 * Documentation:
 * https://www.ncbi.nlm.nih.gov/books/NBK25499/#chapter4.ESearch
 */

export interface PubmedSearchResponse {
    header: Record<string, any>;
    esearchresult: ESearchResult;
}

export interface ESearchResult {
    /*
     * In the actual JSON, these are strings.
     * We keep them as strings here and convert to numbers where needed.
     */
    count: string;
    retmax: string;
    retstart: string;

    querykey?: string;
    webenv?: string;

    idlist: string[];
    translationset?: any[];
    translationstack?: any[];
    querytranslation?: string;
}
