import { authenticate } from "../shopify.server";
import { supabaseAdmin } from "../db.server";
import type { ActionFunctionArgs } from "@remix-run/node";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop } = await authenticate.webhook(request);

  switch (topic) {
    case "APP_UNINSTALLED":
      // Clean up sessions for this shop so reinstallation works cleanly.
      // Guide data is kept — merchant can reinstall and keep their content.
      await supabaseAdmin
        .from("shopify_sessions")
        .delete()
        .eq("shop", shop);
      break;
    default:
      console.log(`[Webhook] Unhandled topic: ${topic}`);
  }

  return new Response(null, { status: 200 });
};
