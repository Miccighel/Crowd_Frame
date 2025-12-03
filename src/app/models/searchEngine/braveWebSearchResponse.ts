// models/searchEngine/braveWebSearchResponse.ts

export interface BraveMetaUrl {
    scheme?: string;
    netloc?: string;
    hostname?: string;
    favicon?: string;
    path?: string;
}

export interface BraveSearchResult {
    /* SearchResult / Result merged model */
    type: string;                  // "search_result"
    subtype?: string;              // "generic"
    title: string;
    url: string;
    description?: string;
    page_age?: string;
    page_fetched?: string;
    language?: string;
    family_friendly: boolean;
    extra_snippets?: string[];
    meta_url?: BraveMetaUrl;
}

export interface BraveSearchCollection {
    type: string;                  // "search"
    results: BraveSearchResult[];
    family_friendly: boolean;
}

export interface BraveQueryInfo {
    original: string;
    altered?: string;
    country?: string;
    language?: any;
    is_navigational?: boolean;
    more_results_available?: boolean;
}

export interface BraveWebSearchResponse {
    type: string;                  // "search"
    query?: BraveQueryInfo;
    web?: BraveSearchCollection;
    // other sections (news, videos, mixed, etc.) exist but we ignore them
}
