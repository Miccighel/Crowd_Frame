import { CategoricalInfo } from "src/app/models/conversational/common.model";

/* =============================================================================
 * ChatHelper
 * -----------------------------------------------------------------------------
 * Utility functions used by the chat components.
 * ============================================================================= */

export default class ChatHelper {

    /* -------------------------------------------------------------------------
     * Returns true when `msg` is an integer ≥ `min` (and ≤ `max` if provided).
     * Accepts numeric strings; rejects non-finite and non-integer values.
     * ---------------------------------------------------------------------- */
    static validMsg(msg: unknown, min: number, max: number | null = null): boolean {
        const n = typeof msg === 'number' ? msg : Number((msg as any));
        if (!Number.isFinite(n) || !Number.isInteger(n)) return false;
        if (n < min) return false;
        if (max != null && n > max) return false;
        return true;
    }

    /* -------------------------------------------------------------------------
     * Returns true when `msg` matches a permissive HTTP(S) or host-only URL.
     * The protocol is optional; IPv4 and domain forms are accepted.
     * ---------------------------------------------------------------------- */
    static urlValid(msg: unknown): boolean {
        const s = String(msg ?? '').trim();
        const pattern =
            /^(https?:\/\/)?(?:(?:(\w(?:[\w-]*\.)+\w{2,})|((\d{1,3}\.){3}\d{1,3})))(?::\d+)?(\/[-\w\d%_.~+]*)*(\?[;&\w%_.~+=-]*)?(#\w*)?$/i;
        return pattern.test(s);
    }

    /* -------------------------------------------------------------------------
     * Returns the minimum numeric `value` from a list of { value } items.
     * If the list is empty, returns NaN.
     * ---------------------------------------------------------------------- */
    static getCategoricalMinInfo(objects: CategoricalInfo[]): number {
        if (!objects || objects.length === 0) return NaN;
        return objects.reduce((min, curr) => {
            const v = Number((curr as any).value);
            return v < min ? v : min;
        }, Number.POSITIVE_INFINITY);
    }

    /* -------------------------------------------------------------------------
     * Returns the maximum numeric `value` from a list of { value } items.
     * If the list is empty, returns NaN.
     * ---------------------------------------------------------------------- */
    static getCategoricalMaxInfo(objects: CategoricalInfo[]): number {
        if (!objects || objects.length === 0) return NaN;
        return objects.reduce((max, curr) => {
            const v = Number((curr as any).value);
            return v > max ? v : max;
        }, Number.NEGATIVE_INFINITY);
    }

    /* -------------------------------------------------------------------------
     * Returns an integer in [0, max). If `max` ≤ 0, returns 0.
     * ---------------------------------------------------------------------- */
    static rand(max: number): number {
        if (!Number.isFinite(max) || max <= 0) return 0;
        return Math.floor(Math.random() * max);
    }

    /* -------------------------------------------------------------------------
     * Returns a composite random message drawn from two lists.
     * Falls back to empty strings if any list is missing.
     * ---------------------------------------------------------------------- */
    static getRandomMessage(
        randomMessagesFirstPart: string[],
        randomMessagesSecondPart: string[]
    ): string {
        const a = Array.isArray(randomMessagesFirstPart) ? randomMessagesFirstPart : [''];
        const b = Array.isArray(randomMessagesSecondPart) ? randomMessagesSecondPart : [''];
        const left = a.length ? a[this.rand(a.length)] : '';
        const right = b.length ? b[this.rand(b.length)] : '';
        return `${left} ${right}`.trim();
    }

    /* -------------------------------------------------------------------------
     * Returns the total number of `child` elements across items in `parent`.
     * Assumes each parent item has an array property named by `child`.
     * ---------------------------------------------------------------------- */
    static getTotalElements(parent: Array<Record<string, any>>, child: string): number {
        if (!Array.isArray(parent)) return 0;
        return parent.reduce((acc, el) => acc + (Array.isArray(el?.[child]) ? el[child].length : 0), 0);
    }

    /* -------------------------------------------------------------------------
     * Returns the current epoch time in seconds (integer).
     * ---------------------------------------------------------------------- */
    static getTimeStampInSeconds(): number {
        return Math.floor(Date.now() / 1000);
    }

    /* -------------------------------------------------------------------------
     * Returns a simple unique id string.
     * Uses crypto.getRandomValues when available; falls back to Math.random.
     * ---------------------------------------------------------------------- */
    static getUid(): string {
        const rand = (len = 8) => {
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
                const buf = new Uint8Array(len);
                crypto.getRandomValues(buf);
                return Array.from(buf, b => b.toString(16).padStart(2, '0')).join('');
            }
            return Math.random().toString(36).slice(2);
        };
        return `${Date.now().toString(36)}-${rand(8)}`;
    }

    /* -------------------------------------------------------------------------
     * Returns `word` in Title Case, splitting on hyphens and collapsing spaces.
     * Example: "very-long-NAME" → "Very Long Name"
     * ---------------------------------------------------------------------- */
    static capitalize(word: string): string {
        if (!word) return word;
        return word
            .split('-')
            .filter(Boolean)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
            .join(' ')
            .trim();
    }
}
