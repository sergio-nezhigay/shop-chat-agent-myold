import prisma from "../db.server";
import { unauthenticated } from "../shopify.server";

// Warranty term (months) lives in product metafield custom.warranty, which the
// UCP catalog search doesn't return. "0" or empty means "not set".
const QUERY = `#graphql
  query warranties($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Product { id metafield(namespace: "custom", key: "warranty") { value } }
    }
  }`;

/**
 * Adds `warranty_months` to each product in a search_catalog result, in place.
 * Never throws: on any failure the result is left as it was.
 * @param {Object} toolUseResponse - MCP result; content[0].text is JSON with `products`
 */
export async function attachWarranties(toolUseResponse) {
  try {
    const block = toolUseResponse?.content?.[0];
    if (!block || typeof block.text !== "string") return;
    const data = JSON.parse(block.text);
    const products = Array.isArray(data?.products) ? data.products : [];
    const ids = products.map((p) => p.id).filter((id) => /^gid:\/\/shopify\/Product\//.test(id || ""));
    if (!ids.length) return;

    const session = await prisma.session.findFirst({ where: { isOnline: false } });
    if (!session) return;
    const { storefront } = await unauthenticated.storefront(session.shop);
    const res = await storefront.graphql(QUERY, { variables: { ids } });
    const body = await res.json();

    const byId = new Map();
    for (const node of body?.data?.nodes || []) {
      const months = parseInt(node?.metafield?.value, 10);
      if (node?.id && months > 0) byId.set(node.id, months);
    }
    if (!byId.size) return;
    for (const p of products) {
      if (byId.has(p.id)) p.warranty_months = byId.get(p.id);
    }
    block.text = JSON.stringify(data);
  } catch (error) {
    console.warn("attachWarranties failed:", error?.message || error);
  }
}
