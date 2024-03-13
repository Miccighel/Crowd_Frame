export class PreRetrievedResult {

    elementID: string
    resultUUID: string

    pageName: string
    pageSnippet: string
    pageUrl: string
    pageSummary: string

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
    }

}