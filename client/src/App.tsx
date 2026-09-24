import { Link, Route, Switch } from "wouter";
import { Layout } from "@/components/Layout";
import { HomePage } from "@/pages/Home";
import { SearchPage } from "@/pages/Search";
import { SourcesPage } from "@/pages/Sources";
import { ApiDocsPage } from "@/pages/ApiDocs";

function NotFound() {
    return (
        <div className="mx-auto max-w-md px-4 py-24 text-center">
            <p className="font-mono text-sm text-brand-400">404</p>
            <h1 className="mt-2 text-2xl font-bold text-white">Page not found</h1>
            <Link href="/" className="btn-primary mt-6">
                Back to lookup
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
                <Route path="/api" component={ApiDocsPage} />
                <Route component={NotFound} />
            </Switch>
        </Layout>
    );
}
