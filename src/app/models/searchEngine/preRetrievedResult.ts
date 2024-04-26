export class PreRetrievedResult {

    elementID: string
    resultUUID: string

    pageName: string
    pageSnippet: string
    pageUrl: string
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
        this.queryText = data ? data["query_text"] : null;
    }

    public prettyPrintSummary() {
        if (!this.pageSummary) {
            return ''; // Return an empty string if no summary is provided or it's null/undefined
        }
        // Replace occurrences of two consecutive newlines at the beginning of the string with an empty string
        let formattedSummary = this.pageSummary.replace(/^\n\n/, '');
        // Replace remaining occurrences of single newline characters with <br> tags
        formattedSummary = formattedSummary.replace(/\n/g, '<br>');
        return formattedSummary
    }

}