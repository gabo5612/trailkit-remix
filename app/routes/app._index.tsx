import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  BlockStack,
  InlineGrid,
  Box,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { supabaseAdmin } from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const [{ count: guides }, { count: routes }, { count: pois }] =
    await Promise.all([
      supabaseAdmin
        .from("shopify_guides")
        .select("*", { count: "exact", head: true })
        .eq("shop", session.shop),
      supabaseAdmin
        .from("shopify_routes")
        .select("*", { count: "exact", head: true })
        .eq("shop", session.shop),
      supabaseAdmin
        .from("shopify_pois")
        .select("*", { count: "exact", head: true })
        .eq("shop", session.shop),
    ]);
  return json({ guides: guides ?? 0, routes: routes ?? 0, pois: pois ?? 0 });
}

export default function Dashboard() {
  const { guides, routes, pois } = useLoaderData<typeof loader>();
  return (
    <Page title="TrailKit">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Welcome to TrailKit
              </Text>
              <Text as="p" tone="subdued">
                Create interactive trail maps with routes and points of interest
                for your Shopify store.
              </Text>
              <InlineGrid columns={3} gap="400">
                <StatCard label="Trail Guides" value={guides} />
                <StatCard label="Routes" value={routes} />
                <StatCard label="POIs" value={pois} />
              </InlineGrid>
              <Box>
                <Button url="/app/guides" variant="primary">
                  Manage Guides
                </Button>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">
                How to add a map to your store
              </Text>
              <Text as="p">
                1. Create a guide and copy its ID from the guides list.
              </Text>
              <Text as="p">
                2. Go to{" "}
                <strong>
                  Online Store → Themes → Customize → Add block → Apps →
                  TrailKit Map
                </strong>
              </Text>
              <Text as="p">3. Paste the Guide ID into the block settings.</Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <BlockStack gap="100">
        <Text variant="heading2xl" as="p">
          {value}
        </Text>
        <Text as="p" tone="subdued">
          {label}
        </Text>
      </BlockStack>
    </Card>
  );
}
