/*
 * This interface provides a representation of the raw response returned by a request to eSummary API of Pubmed
 * Documentation:
 * https://www.ncbi.nlm.nih.gov/books/NBK25499/#chapter4.ESummary
 */
export interface PubmedSummaryResponse {
    header: Object;
    result: Object;
}
