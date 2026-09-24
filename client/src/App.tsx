import { Link, Route, Switch } from "wouter";
import { Layout } from "@/components/Layout";
import { HomePage } from "@/pages/Home";
import { SearchPage } from "@/pages/Search";
import { SourcesPage } from "@/pages/Sources";
import { ApiDocsPage } from "@/pages/ApiDocs";

function NotFound() {
    return (
        <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-20 text-center">
            <h1 className="text-title-2 font-semibold text-fg">Page not found</h1>
            <p className="text-body text-fg-secondary">Check the address or start a new lookup.</p>
            <Link href="/" className="mt-2 inline-flex h-10 items-center rounded-md border border-line-strong bg-surface px-4 text-footnote font-semibold text-fg transition-colors duration-fast hover:bg-surface-2">
                Go to lookup
            </Link>
        </div>
    );
}

export default function App() {
    return (
        <Layout>
            <Switch>
                <Route path="/" component={HomePage} />
                <Route path="/search" component={SearchPage} />
                <Route path="/sources" component={SourcesPage} />
                {/* Not /api: the server's API router owns that prefix, so a reload there returned JSON (audit #32). */}
                <Route path="/api-docs" component={ApiDocsPage} />
                <Route component={NotFound} />
            </Switch>
        </Layout>
    );
}
