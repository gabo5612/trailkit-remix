import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { useLoaderData, useFetcher, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Button,
  BlockStack,
  InlineStack,
  Text,
  Divider,
  Banner,
  DataTable,
  Badge,
  Select,
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import { supabaseAdmin } from "../db.server";

// ── GPX parser (inline, no deps) ──────────────────────────────
function parseGPX(gpx: string): [number, number][] {
  const coords: [number, number][] = [];
  const re = /<trkpt\b([^>]+)>/g;
  let m;
  while ((m = re.exec(gpx)) !== null) {
    const attrs = m[1];
    const lat = /lat="([^"]+)"/.exec(attrs)?.[1];
    const lon = /lon="([^"]+)"/.exec(attrs)?.[1];
    if (lat && lon) coords.push([parseFloat(lat), parseFloat(lon)]);
  }
  return coords;
}

function gpxCenter(coords: [number, number][]): [number, number] {
  if (!coords.length) return [10, -66];
  const lat = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const lng = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  return [lat, lng];
}

// ── Loader ────────────────────────────────────────────────────
export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const { id } = params;

  const { data: guide } = await supabaseAdmin
    .from("shopify_guides")
    .select("*")
    .eq("id", id!)
    .eq("shop", session.shop)
    .maybeSingle();

  if (!guide) throw new Response("Guide not found", { status: 404 });

  const [{ data: routes }, { data: pois }] = await Promise.all([
    supabaseAdmin
      .from("shopify_routes")
      .select("id, name, color, difficulty, distance_km")
      .eq("guide_id", id!)
      .order("created_at"),
    supabaseAdmin
      .from("shopify_pois")
      .select("id, name, lat, lng, icon_type")
      .eq("guide_id", id!)
      .order("created_at"),
  ]);

  return json({ guide, routes: routes ?? [], pois: pois ?? [] });
}

// ── Action ────────────────────────────────────────────────────
export async function action({ request, params }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  switch (intent) {
    case "update-guide": {
      await supabaseAdmin
        .from("shopify_guides")
        .update({
          title: formData.get("title"),
          description: formData.get("description") || null,
          center_lat: parseFloat(formData.get("center_lat") as string) || null,
          center_lng: parseFloat(formData.get("center_lng") as string) || null,
          zoom_level: parseInt(formData.get("zoom_level") as string) || 12,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.id!)
        .eq("shop", session.shop);
      return json({ success: true, intent });
    }

    case "delete-guide": {
      await supabaseAdmin
        .from("shopify_guides")
        .delete()
        .eq("id", params.id!)
        .eq("shop", session.shop);
      return redirect("/app/guides");
    }

    case "add-route": {
      const gpxText = formData.get("gpx_data") as string;
      const coords = gpxText ? parseGPX(gpxText) : [];
      const [lat, lng] = gpxCenter(coords);
      await supabaseAdmin.from("shopify_routes").insert({
        guide_id: params.id!,
        shop: session.shop,
        name: formData.get("route_name") || "New Route",
        color: formData.get("route_color") || "#ef4444",
        difficulty: formData.get("route_difficulty") || "moderate",
        gpx_data: gpxText || null,
        route_coords: coords.length ? coords : null,
      });
      // Auto-center guide on first route
      if (coords.length) {
        const { data: guide } = await supabaseAdmin
          .from("shopify_guides")
          .select("center_lat")
          .eq("id", params.id!)
          .maybeSingle();
        if (!guide?.center_lat) {
          await supabaseAdmin
            .from("shopify_guides")
            .update({ center_lat: lat, center_lng: lng })
            .eq("id", params.id!);
        }
      }
      return json({ success: true, intent });
    }

    case "delete-route": {
      await supabaseAdmin
        .from("shopify_routes")
        .delete()
        .eq("id", formData.get("route_id"))
        .eq("shop", session.shop);
      return json({ success: true, intent });
    }

    case "add-poi": {
      await supabaseAdmin.from("shopify_pois").insert({
        guide_id: params.id!,
        shop: session.shop,
        name: formData.get("poi_name") || "New POI",
        description: formData.get("poi_description") || null,
        lat: parseFloat(formData.get("poi_lat") as string),
        lng: parseFloat(formData.get("poi_lng") as string),
        icon_type: formData.get("poi_icon") || "default",
      });
      return json({ success: true, intent });
    }

    case "delete-poi": {
      await supabaseAdmin
        .from("shopify_pois")
        .delete()
        .eq("id", formData.get("poi_id"))
        .eq("shop", session.shop);
      return json({ success: true, intent });
    }
  }

  return json({ error: "Unknown intent" }, { status: 400 });
}

// ── UI ────────────────────────────────────────────────────────
export default function GuideEditor() {
  const { guide, routes, pois } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const [title, setTitle] = useState(guide.title);
  const [desc, setDesc] = useState(guide.description ?? "");
  const [lat, setLat] = useState(String(guide.center_lat ?? ""));
  const [lng, setLng] = useState(String(guide.center_lng ?? ""));
  const [zoom, setZoom] = useState(String(guide.zoom_level ?? "12"));

  // Route form state
  const [routeName, setRouteName] = useState("");
  const [routeColor, setRouteColor] = useState("#ef4444");
  const [routeDiff, setRouteDiff] = useState("moderate");
  const [gpxData, setGpxData] = useState("");

  // POI form state
  const [poiName, setPoiName] = useState("");
  const [poiDesc, setPoiDesc] = useState("");
  const [poiLat, setPoiLat] = useState("");
  const [poiLng, setPoiLng] = useState("");
  const [poiIcon, setPoiIcon] = useState("default");

  const isSaving = fetcher.state !== "idle";

  return (
    <Page
      title={guide.title}
      backAction={{ content: "Guides", url: "/app/guides" }}
      secondaryActions={[
        {
          content: "Delete guide",
          tone: "critical",
          onAction: () => {
            const fd = new FormData();
            fd.set("intent", "delete-guide");
            fetcher.submit(fd, { method: "POST" });
          },
        },
      ]}
    >
      <Layout>
        {/* Guide Info */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Guide Info
              </Text>
              <Banner tone="info">
                <Text as="p">
                  Guide ID (for the Shopify block):{" "}
                  <strong>{guide.id}</strong>
                </Text>
              </Banner>
              <fetcher.Form method="POST">
                <input type="hidden" name="intent" value="update-guide" />
                <FormLayout>
                  <TextField
                    label="Title"
                    name="title"
                    value={title}
                    onChange={setTitle}
                    autoComplete="off"
                  />
                  <TextField
                    label="Description"
                    name="description"
                    value={desc}
                    onChange={setDesc}
                    multiline={3}
                    autoComplete="off"
                  />
                  <FormLayout.Group>
                    <TextField
                      label="Center Latitude"
                      name="center_lat"
                      value={lat}
                      onChange={setLat}
                      helpText="e.g. 10.4806"
                      autoComplete="off"
                    />
                    <TextField
                      label="Center Longitude"
                      name="center_lng"
                      value={lng}
                      onChange={setLng}
                      helpText="e.g. -66.9036"
                      autoComplete="off"
                    />
                    <TextField
                      label="Zoom Level"
                      name="zoom_level"
                      value={zoom}
                      onChange={setZoom}
                      helpText="1–18, default 12"
                      autoComplete="off"
                    />
                  </FormLayout.Group>
                  <Button submit variant="primary" loading={isSaving}>
                    Save guide
                  </Button>
                </FormLayout>
              </fetcher.Form>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Divider />
        </Layout.Section>

        {/* Routes */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Routes ({routes.length})
              </Text>

              {routes.length > 0 && (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text"]}
                  headings={["Name", "Difficulty", "Color", ""]}
                  rows={routes.map((r) => [
                    r.name,
                    <Badge key={r.id}>{r.difficulty}</Badge>,
                    <span
                      key={r.id}
                      style={{
                        display: "inline-block",
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        background: r.color,
                        verticalAlign: "middle",
                      }}
                    />,
                    <fetcher.Form method="POST" key={r.id}>
                      <input type="hidden" name="intent" value="delete-route" />
                      <input type="hidden" name="route_id" value={r.id} />
                      <Button submit tone="critical" variant="plain" size="slim">
                        Delete
                      </Button>
                    </fetcher.Form>,
                  ])}
                />
              )}

              <Divider />
              <Text variant="headingSm" as="h3">
                Add Route
              </Text>
              <fetcher.Form
                method="POST"
                onSubmit={() => {
                  setRouteName("");
                  setGpxData("");
                }}
              >
                <input type="hidden" name="intent" value="add-route" />
                <FormLayout>
                  <FormLayout.Group>
                    <TextField
                      label="Route name"
                      name="route_name"
                      value={routeName}
                      onChange={setRouteName}
                      autoComplete="off"
                    />
                    <Select
                      label="Difficulty"
                      name="route_difficulty"
                      options={[
                        { label: "Easy", value: "easy" },
                        { label: "Moderate", value: "moderate" },
                        { label: "Hard", value: "hard" },
                        { label: "Expert", value: "expert" },
                      ]}
                      value={routeDiff}
                      onChange={setRouteDiff}
                    />
                    <TextField
                      label="Color"
                      name="route_color"
                      value={routeColor}
                      onChange={setRouteColor}
                      helpText="Hex color, e.g. #ef4444"
                      autoComplete="off"
                    />
                  </FormLayout.Group>
                  <TextField
                    label="GPX Data (paste GPX XML)"
                    name="gpx_data"
                    value={gpxData}
                    onChange={setGpxData}
                    multiline={6}
                    helpText="Paste the contents of your .gpx file. Coordinates are extracted automatically."
                    autoComplete="off"
                  />
                  <Button submit variant="primary" loading={isSaving}>
                    Add route
                  </Button>
                </FormLayout>
              </fetcher.Form>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* POIs */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Points of Interest ({pois.length})
              </Text>

              {pois.length > 0 && (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text"]}
                  headings={["Name", "Latitude", "Longitude", ""]}
                  rows={pois.map((p) => [
                    p.name,
                    String(p.lat),
                    String(p.lng),
                    <fetcher.Form method="POST" key={p.id}>
                      <input type="hidden" name="intent" value="delete-poi" />
                      <input type="hidden" name="poi_id" value={p.id} />
                      <Button submit tone="critical" variant="plain" size="slim">
                        Delete
                      </Button>
                    </fetcher.Form>,
                  ])}
                />
              )}

              <Divider />
              <Text variant="headingSm" as="h3">
                Add Point of Interest
              </Text>
              <fetcher.Form
                method="POST"
                onSubmit={() => {
                  setPoiName("");
                  setPoiDesc("");
                  setPoiLat("");
                  setPoiLng("");
                }}
              >
                <input type="hidden" name="intent" value="add-poi" />
                <FormLayout>
                  <FormLayout.Group>
                    <TextField
                      label="Name"
                      name="poi_name"
                      value={poiName}
                      onChange={setPoiName}
                      autoComplete="off"
                    />
                    <Select
                      label="Icon type"
                      name="poi_icon"
                      options={[
                        { label: "Default", value: "default" },
                        { label: "Camping", value: "camping" },
                        { label: "Water", value: "water" },
                        { label: "Viewpoint", value: "viewpoint" },
                        { label: "Danger", value: "danger" },
                        { label: "Parking", value: "parking" },
                      ]}
                      value={poiIcon}
                      onChange={setPoiIcon}
                    />
                  </FormLayout.Group>
                  <FormLayout.Group>
                    <TextField
                      label="Latitude"
                      name="poi_lat"
                      value={poiLat}
                      onChange={setPoiLat}
                      helpText="e.g. 10.4806"
                      autoComplete="off"
                    />
                    <TextField
                      label="Longitude"
                      name="poi_lng"
                      value={poiLng}
                      onChange={setPoiLng}
                      helpText="e.g. -66.9036"
                      autoComplete="off"
                    />
                  </FormLayout.Group>
                  <TextField
                    label="Description (optional)"
                    name="poi_description"
                    value={poiDesc}
                    onChange={setPoiDesc}
                    multiline={2}
                    autoComplete="off"
                  />
                  <Button submit variant="primary" loading={isSaving}>
                    Add POI
                  </Button>
                </FormLayout>
              </fetcher.Form>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
