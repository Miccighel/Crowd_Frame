import {PreRetrievedResult} from "./preRetrievedResult";

export class SearchEngineSettings {

    source: string
    domains_filter?: Array<string>
    pre_retrieved_results?: Array<PreRetrievedResult>
    pre_retrieved_results_settings?: PreRetrievedResultsSettings

    constructor(
        data = null as JSON
    ) {
        this.source = data ? data["source"] : null;
        this.domains_filter = new Array<string>();
        if (data) if ("domains_filter" in data) for (let domain of data["domains_filter"] as Array<string>) this.domains_filter.push(domain)
        if (data) {
            if (data['domains_to_filter']) {
                for (let domain of data["domains_to_filter"]) this.domains_filter.push(domain)
            }
        } else {
            this.domains_filter = new Array<string>();
        }
        this.pre_retrieved_results = new Array<PreRetrievedResult>();
        if (data) {
            if (data['results_retrieved']) {
                let preRetrievedResultsSet = data["results_retrieved"]
                if (preRetrievedResultsSet && typeof preRetrievedResultsSet === 'object') {
                    for (let [elementId, preRetrievedResults] of Object.entries(preRetrievedResultsSet)) {
                        for (let preRetrievedResult of Object.values(preRetrievedResults)) {
                            this.pre_retrieved_results.push(new PreRetrievedResult(elementId, preRetrievedResult))
                        }
                    }
                }
            }
        }
        if (data) {
            if (data['results_retrieved_settings']) {
                this.pre_retrieved_results_settings = new PreRetrievedResultsSettings(data)
            } else {
                this.pre_retrieved_results_settings = null
            }
        }
    }

}

export enum DisplayModality {
    Link = 'link',
    Summary = 'summary'
}

export class PreRetrievedResultsSettings {

    displayModality: DisplayModality | null;

    constructor(
        data = null as JSON
    ) {
        if (data) {
            if (data['results_retrieved_settings']) {
                if (data['results_retrieved_settings']['display_modality']) {
                    switch (data['results_retrieved_settings']['display_modality']) {
                        case DisplayModality.Link:
                            this.displayModality = DisplayModality.Link;
                            break;
                        case DisplayModality.Summary:
                            this.displayModality = DisplayModality.Summary;
                            break;
                        default:
                            this.displayModality = null;
                    }
                }
            }
        } else {
            this.displayModality = null;
        }
    }
}
