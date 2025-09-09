/* ============================================================================
 * src/app/app-routing.module.ts
 * Central route configuration. Routes are intentionally minimal:
 * - Standalone viewer for pre-retrieved search results
 * - Dedicated admin shell
 * - Base shell as the default entry point
 * - Wildcard fallback to root
 * ============================================================================ */

import {NgModule} from '@angular/core';
import {Routes, RouterModule} from '@angular/router';

import {PreRetrievedResultSummaryComponent} from './components/skeleton/document/dimension/search-engine/pre-retrieved-result-summary/pre-retrieved-result-summary.component';
import {BaseComponent} from './components/base/base.component';
import {AdminComponent} from './components/admin/admin.component';
import {adminQueryRedirectGuard} from './guards/admin-query-redirect.guard';

const routes: Routes = [
    /* --------------------------------------------------------------------------
     * Result summary: deep-link to a specific pre-retrieved search result by UUID
     * -------------------------------------------------------------------------- */
    {
        path: 'result-summary/:uuid',
        component: PreRetrievedResultSummaryComponent,
        /* Ensures the entire URL must exactly match the path */
        pathMatch: 'full'
    },

    /* --------------------------------------------------------------------------
     * Admin: dedicated route (separate from the main shell overlay)
     * -------------------------------------------------------------------------- */
    {
        path: 'admin',
        component: AdminComponent,
        /* Ensures the entire URL must exactly match the path */
        pathMatch: 'full'
    },

    /* --------------------------------------------------------------------------
     * Root: BaseComponent hosts the global overlay and orchestrates views
     * Back-compat: redirect to /admin when ?admin=true is present
     * -------------------------------------------------------------------------- */
    {
        path: '',
        component: BaseComponent,
        /* Matches only when the path is exactly empty */
        pathMatch: 'full',
        /* Back-compat for ?admin=true → redirects to /admin */
        canActivate: [adminQueryRedirectGuard]
    },

    /* --------------------------------------------------------------------------
     * Fallback: any unknown route redirects to root
     * -------------------------------------------------------------------------- */
    {
        path: '**',
        redirectTo: ''
    }
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})
export class AppRoutingModule {
}
