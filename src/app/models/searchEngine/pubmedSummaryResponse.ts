/*
 * Interfaces for the raw response returned by a request to the PubMed eSummary API.
 * Documentation:
 * https://www.ncbi.nlm.nih.gov/books/NBK25499/#chapter4.ESummary
 */

export interface PubmedSummaryResponse {
    header: Record<string, any>;
    /*
     * `result` is a map from article ID to its metadata object.
     * There is also usually a `uids` array inside, but we only need
     * direct lookup by id (result[articleId]).
     */
    result: {
        [id: string]: any;
    };
}
