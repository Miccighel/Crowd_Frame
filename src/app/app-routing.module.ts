import {NgModule} from '@angular/core';
import {Routes, RouterModule} from '@angular/router';
import {PreRetrievedResultSummaryComponent} from './components/skeleton/document/dimension/search-engine/pre-retrieved-result-summary/pre-retrieved-result-summary.component';
import {LoaderComponent} from "./components/loader/loader.component";

const routes: Routes = [
    {
        // Route for viewing result summary based on specific IDs and UUIDs.
        // This is used to display detailed information for a pre retrieved search engine result.
        path: 'result-summary/:uuid',
        component: PreRetrievedResultSummaryComponent,
        pathMatch: 'full' // Ensures the entire URL must exactly match the path.
    },
    {
        // Default root route which shows a Loader component.
        // This is typically shown when the user first visits the site at the base URL.
        path: '',
        component: LoaderComponent,
        pathMatch: 'full' // Matches only when the path is exactly empty.
    },
    {
        // Wildcard route to catch all undefined paths.
        // Redirects to the root, effectively showing the LoaderComponent for any unknown routes.
        path: '**',
        redirectTo: '' // Redirects to the root path ('')
    }
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})

export class AppRoutingModule {
}
