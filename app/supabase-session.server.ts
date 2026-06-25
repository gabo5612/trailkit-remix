import { Session } from "@shopify/shopify-api";
import type { SessionStorage } from "@shopify/shopify-app-remix/server";
import { supabaseAdmin } from "./db.server";

export class SupabaseSessionStorage implements SessionStorage {
  async storeSession(session: Session): Promise<boolean> {
    const { error } = await supabaseAdmin.from("shopify_sessions").upsert({
      id: session.id,
      shop: session.shop,
      state: session.state,
      is_online: session.isOnline,
      scope: session.scope ?? null,
      expires: session.expires?.toISOString() ?? null,
      access_token: session.accessToken ?? null,
      updated_at: new Date().toISOString(),
    });
    if (error) console.error("[SessionStorage] store error:", error.message);
    return !error;
  }

  async loadSession(id: string): Promise<Session | undefined> {
    const { data } = await supabaseAdmin
      .from("shopify_sessions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!data) return undefined;
    return new Session({
      id: data.id,
      shop: data.shop,
      state: data.state,
      isOnline: data.is_online,
      scope: data.scope ?? undefined,
      expires: data.expires ? new Date(data.expires) : undefined,
      accessToken: data.access_token ?? undefined,
    });
  }

  async deleteSession(id: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from("shopify_sessions")
      .delete()
      .eq("id", id);
    return !error;
  }

  async deleteSessions(ids: string[]): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from("shopify_sessions")
      .delete()
      .in("id", ids);
    return !error;
  }

  async findSessionsByShop(shop: string): Promise<Session[]> {
    const { data } = await supabaseAdmin
      .from("shopify_sessions")
      .select("*")
      .eq("shop", shop);
    return (data ?? []).map(
      (d) =>
        new Session({
          id: d.id,
          shop: d.shop,
          state: d.state,
          isOnline: d.is_online,
          scope: d.scope ?? undefined,
          expires: d.expires ? new Date(d.expires) : undefined,
          accessToken: d.access_token ?? undefined,
        })
    );
  }
}
