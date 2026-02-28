import { useLoaderData, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { listConversations } from "../db.server";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  IndexTable,
  useIndexResourceState,
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

  return { conversations, page, totalPages };
};

function formatDate(dateString) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}.${month}, ${hours}:${minutes}`;
}

function parseContent(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join(" ");
    }
    return String(parsed);
  } catch {
    return raw;
  }
}

function truncateText(text, length = 60) {
  if (!text) return "No messages";
  return text.length > length ? text.substring(0, length) + "..." : text;
}

export default function ConversationsList() {
  const { conversations, page, totalPages } = useLoaderData();
  const navigate = useNavigate();

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(conversations);

  const rowMarkup = conversations.map((conv, index) => {
    const lastMessage = conv.messages && conv.messages.length > 0 ? conv.messages[0] : null;
    let messagePreview = "No messages";
    if (lastMessage) {
        const textContent = parseContent(lastMessage.content);
        messagePreview = truncateText(textContent, 80);
    }
    
    return (
      <IndexTable.Row
        id={conv.id}
        key={conv.id}
        selected={selectedResources.includes(conv.id)}
        position={index}
        onClick={() => {
          navigate(`/app/conversations/${conv.id}`);
        }}
      >
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {formatDate(conv.updatedAt)}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span" tone="subdued">
            {conv._count.messages}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span" truncate>
            {messagePreview}
          </Text>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page>
      <TitleBar title="Chat Conversations" />

      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card padding="0">
              <IndexTable
                resourceName={{ singular: 'conversation', plural: 'conversations' }}
                itemCount={conversations.length}
                selectedItemsCount={
                  allResourcesSelected ? 'All' : selectedResources.length
                }
                onSelectionChange={handleSelectionChange}
                headings={[
                  { title: 'Last Updated' },
                  { title: 'Messages' },
                  { title: 'Last Message Preview' },
                ]}
                selectable={false}
                pagination={{
                  hasNext: page < totalPages,
                  hasPrevious: page > 1,
                  onNext: () => navigate(`/app?page=${page + 1}`),
                  onPrevious: () => navigate(`/app?page=${page - 1}`)
                }}
              >
                {rowMarkup}
              </IndexTable>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}


