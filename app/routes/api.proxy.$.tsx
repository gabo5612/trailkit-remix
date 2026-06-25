import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { supabaseAdmin } from "../db.server";

/**
 * App Proxy endpoint — handles requests from:
 * https://[store].myshopify.com/apps/trailkit/*
 *
 * Shopify verifies HMAC and adds ?shop= to the request.
 * authenticate.public.appProxy() validates the signature.
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  await authenticate.public.appProxy(request);

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") ?? "";
  const segments = (params["*"] ?? "").split("/").filter(Boolean);

  // GET /api/proxy/guide/:id
  if (segments[0] === "guide" && segments[1]) {
    const guideId = segments[1];

    const { data: guide } = await supabaseAdmin
      .from("shopify_guides")
      .select("id, title, description, center_lat, center_lng, zoom_level")
      .eq("id", guideId)
      .eq("shop", shop)
      .maybeSingle();

    if (!guide) {
      return json({ error: "Guide not found" }, { status: 404 });
    }

    const [{ data: routes }, { data: pois }] = await Promise.all([
      supabaseAdmin
        .from("shopify_routes")
        .select("id, name, color, difficulty, route_coords")
        .eq("guide_id", guideId),
      supabaseAdmin
        .from("shopify_pois")
        .select("id, name, description, lat, lng, icon_type")
        .eq("guide_id", guideId),
    ]);

    return json(
      {
        id: guide.id,
        title: guide.title,
        center_lat: guide.center_lat,
        center_lng: guide.center_lng,
        zoom_level: guide.zoom_level,
        routes: routes ?? [],
        pois: pois ?? [],
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=60",
        },
      }
    );
  }

  return json({ error: "Not found" }, { status: 404 });
}
