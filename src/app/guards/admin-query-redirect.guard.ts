/* Guard that supports legacy ?admin=true deep link by redirecting to /admin */
import {inject} from '@angular/core';
import {CanActivateFn, Router} from '@angular/router';

export const adminQueryRedirectGuard: CanActivateFn = (route, state) => {
    /* Parameter is unused (signature compliance / future-proofing) */
    void state; // TS6133 suppression

    /* Router instance is resolved via functional DI */
    const router = inject(Router);

    /* Legacy hook: if ?admin=true is present, redirect to /admin */
    if (route.queryParamMap.get('admin') === 'true') {
        /* Navigation:
           - path: /admin
           - queryParamsHandling: 'preserve' keeps existing query parameters intact
           - replaceUrl: true prevents creating an extra history entry */
        router.navigate(['/admin'], {
            queryParamsHandling: 'preserve',
            replaceUrl: true,
        });
        /* Returning false cancels the current activation (navigation is already triggered) */
        return false;
    }

    /* No legacy flag → allow normal activation */
    return true;
};
