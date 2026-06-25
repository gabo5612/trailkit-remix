import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  ResourceList,
  ResourceItem,
  Text,
  EmptyState,
  BlockStack,
  InlineStack,
  Badge,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { supabaseAdmin } from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const { data: guides } = await supabaseAdmin
    .from("shopify_guides")
    .select("id, title, description, created_at")
    .eq("shop", session.shop)
    .order("created_at", { ascending: false });
  return json({ guides: guides ?? [] });
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const { data } = await supabaseAdmin
    .from("shopify_guides")
    .insert({
      shop: session.shop,
      title: "New Guide",
      center_lat: 10.0,
      center_lng: -66.0,
      zoom_level: 12,
    })
    .select("id")
    .single();
  if (data?.id) return redirect(`/app/guides/${data.id}`);
  return json({ error: "Could not create guide" }, { status: 500 });
}

export default function GuidesPage() {
  const { guides } = useLoaderData<typeof loader>();
  return (
    <Page
      title="Trail Guides"
      primaryAction={{ content: "Create guide", url: "", onAction: undefined }}
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            {guides.length === 0 ? (
              <EmptyState
                heading="Create your first trail guide"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                action={{
                  content: "Create guide",
                  url: "?create=1",
                }}
              >
                <Text as="p">
                  Add trails, routes, and points of interest to display
                  interactive maps in your store.
                </Text>
              </EmptyState>
            ) : (
              <ResourceList
                resourceName={{ singular: "guide", plural: "guides" }}
                items={guides}
                renderItem={(guide) => (
                  <ResourceItem
                    id={guide.id}
                    url={`/app/guides/${guide.id}`}
                    name={guide.title}
                  >
                    <BlockStack gap="100">
                      <InlineStack gap="200" align="start" blockAlign="center">
                        <Text variant="bodyMd" fontWeight="bold" as="h3">
                          {guide.title}
                        </Text>
                        <Badge tone="info">ID: {guide.id.slice(0, 8)}…</Badge>
                      </InlineStack>
                      {guide.description && (
                        <Text variant="bodySm" tone="subdued" as="p">
                          {guide.description}
                        </Text>
                      )}
                    </BlockStack>
                  </ResourceItem>
                )}
              />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
