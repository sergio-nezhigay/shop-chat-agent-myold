import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { listConversations } from "../db.server";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  InlineStack,
  Box,
  Button
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

const PAGE_SIZE = 20;

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  const { conversations, total } = await listConversations({ skip, take: PAGE_SIZE });
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return { conversations, total, page, totalPages };
};

function formatDate(dateString) {
  return new Date(dateString).toLocaleString();
}

function truncateId(id) {
  return id.length > 16 ? `${id.slice(0, 16)}…` : id;
}

export default function ConversationsList() {
  const { conversations, total, page, totalPages } = useLoaderData();

  return (
    <Page>
      <TitleBar title="Chat Conversations" />

      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Text as="p" variant="bodyMd">
              {total} conversation{total !== 1 ? "s" : ""} total
            </Text>

            {conversations.length === 0 ? (
              <Text as="p">No conversations yet.</Text>
            ) : (
              <BlockStack gap="400">
                {conversations.map((conv) => (
                  <Card key={conv.id} padding="400">
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="200">
                        <Text as="h3" variant="headingMd" fontWeight="bold">
                          {truncateId(conv.id)}
                        </Text>
                        <Text as="span" tone="subdued">
                          {conv._count.messages} message{conv._count.messages !== 1 ? "s" : ""}
                          {" · "}Updated {formatDate(conv.updatedAt)}
                        </Text>
                      </BlockStack>
                      <Button url={`/app/conversations/${conv.id}`}>View →</Button>
                    </InlineStack>
                  </Card>
                ))}
              </BlockStack>
            )}

            {totalPages > 1 && (
              <InlineStack gap="400" align="center">
                <Button url={`/app?page=${page - 1}`} disabled={page <= 1}>
                  ← Previous
                </Button>
                <Text>
                  Page {page} of {totalPages}
                </Text>
                <Button url={`/app?page=${page + 1}`} disabled={page >= totalPages}>
                  Next →
                </Button>
              </InlineStack>
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

