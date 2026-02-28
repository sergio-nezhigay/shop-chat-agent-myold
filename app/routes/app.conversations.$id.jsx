import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getConversationWithMessages } from "../db.server";
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

export const loader = async ({ request, params }) => {
  await authenticate.admin(request);

  const conversation = await getConversationWithMessages(params.id);

  if (!conversation) {
    throw new Response("Conversation not found", { status: 404 });
  }

  return { conversation };
};

function parseContent(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return {
        text: parsed
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("\n"),
        hasToolUse: parsed.some((b) => b.type !== "text"),
      };
    }
    return { text: String(parsed), hasToolUse: false };
  } catch {
    return { text: raw, hasToolUse: false };
  }
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}.${month}, ${hours}:${minutes}`;
}

export default function ConversationDetail() {
  const { conversation } = useLoaderData();

  return (
    <Page
      backAction={{ content: 'Conversations', url: '/app' }}
      title="Conversation"
    >
      <TitleBar title="Conversation" />

      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">Conversation details</Text>
              <Text as="p" tone="subdued">ID: {conversation.id}</Text>
              <Text as="p" tone="subdued">Created: {formatDate(conversation.createdAt)}</Text>
              <Text as="p" tone="subdued">Updated: {formatDate(conversation.updatedAt)}</Text>
              <Text as="p" tone="subdued">
                {conversation.messages.length} message{conversation.messages.length !== 1 ? "s" : ""}
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Text as="h2" variant="headingLg">Messages</Text>
          <Box paddingBlockStart="400">
            {conversation.messages.length === 0 ? (
              <Text as="p">No messages in this conversation.</Text>
            ) : (
              <BlockStack gap="400">
                {conversation.messages.map((msg) => {
                  const { text, hasToolUse } = parseContent(msg.content);
                  const isUser = msg.role === "user";

                  return (
                    <Card key={msg.id} background={isUser ? "bg-surface" : "bg-surface-secondary"}>
                      <BlockStack gap="200">
                        <InlineStack align="space-between">
                          <Text as="span" fontWeight="bold" tone={isUser ? "base" : "magic"}>
                            {isUser ? "Customer" : "Assistant"}
                          </Text>
                          <Text as="span" tone="subdued">{formatDate(msg.createdAt)}</Text>
                        </InlineStack>
                        {text && <Text as="p">{text}</Text>}
                        {hasToolUse && (
                          <Text as="p" tone="subdued">[tool call]</Text>
                        )}
                      </BlockStack>
                    </Card>
                  );
                })}
              </BlockStack>
            )}
          </Box>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

