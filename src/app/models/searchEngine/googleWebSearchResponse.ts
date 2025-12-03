// src/app/models/searchEngine/googleWebSearchResponse.ts

export interface GoogleWebSearchResponse {
    kind?: string;
    url?: {
        type?: string;
        template?: string;
    };
    queries?: {
        request?: Array<GoogleQueryInfo>;
        nextPage?: Array<GoogleQueryInfo>;
    };
    searchInformation?: {
        searchTime?: number;
        formattedSearchTime?: string;
        totalResults?: string;
        formattedTotalResults?: string;
    };
    items?: Array<GoogleSearchItem>;
}

export interface GoogleQueryInfo {
    title?: string;
    totalResults?: string;
    searchTerms?: string;
    count?: number;
    startIndex?: number;
}

export interface GoogleSearchItem {
    kind?: string;
    title?: string;
    htmlTitle?: string;
    link?: string;
    displayLink?: string;
    snippet?: string;
    htmlSnippet?: string;
    cacheId?: string;
    formattedUrl?: string;
    htmlFormattedUrl?: string;
    mime?: string;
    fileFormat?: string;
    pagemap?: any;
}
