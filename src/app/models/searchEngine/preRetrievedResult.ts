export class PreRetrievedResult {

    elementID: string
    resultUUID: string

    pageName: string
    pageSnippet: string
    pageUrl: string
    pageTitle: string
    pageSummary: string

    queryText: string

    visited = false
    constructor(
        elementID: string,
        data: Object
    ) {
        this.elementID = elementID
        this.resultUUID = data ? data["result_uuid"] : null;
        this.pageName = data ? data["page_name"] : null;
        this.pageSnippet = data ? data["page_snippet"] : null;
        this.pageUrl = data ? data["page_url"] : null;
        this.pageSummary = data ? data["page_summary"] : null;
        this.pageTitle = data ? data["page_title"] : null;
        this.queryText = data ? data["query_text"] : null;
    }

    public prettyPrintSummary() {
        if (!this.pageSummary) {
            return ''; // Return an empty string if no summary is provided or it's null/undefined
        }
        return this.pageSummary
    }

}