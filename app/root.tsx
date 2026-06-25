import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import { addDocumentResponseHeaders } from "./shopify.server";
import type { LoaderFunctionArgs, LinksFunction } from "@remix-run/node";

export const links: LinksFunction = () => [];

export async function loader({ request }: LoaderFunctionArgs) {
  addDocumentResponseHeaders(request, new Headers());
  return null;
}

export default function App() {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
