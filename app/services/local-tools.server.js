/**
 * Local Tools Service
 * Defines and executes tools that run locally without MCP
 */

/**
 * Available local tools with their schemas
 */
export const localTools = [
  {
    name: "get_store_info",
    description: "Get basic store information including hours, contact details, and policies. Use this when customers ask about store hours, contact information, or general store details.",
    input_schema: {
      type: "object",
      properties: {
        info_type: {
          type: "string",
          enum: ["hours", "contact", "shipping", "all"],
          description: "Type of store information to retrieve"
        }
      },
      required: ["info_type"]
    }
  },
  {
    name: "add_to_cart",
    description: "Add a specific product variant to the customer's real storefront cart (the one shown by the cart icon and /cart page). Call this only after search_catalog has resolved the exact variant the customer wants. Do not use update_cart or get_cart — they operate on a separate, disconnected cart that the storefront never shows to the customer.",
    input_schema: {
      type: "object",
      properties: {
        variant_id: {
          type: "string",
          description: "The product variant id from search_catalog's variants[].id (GID or numeric)."
        },
        quantity: {
          type: "integer",
          description: "Quantity to add. Defaults to 1.",
          default: 1
        }
      },
      required: ["variant_id"]
    }
  },
  {
    name: "prepare_checkout",
    description: "Show the customer a 'Перейти до оформлення' button that opens the store's checkout with their delivery details already filled in. Call it when the customer wants to place an order and has given their delivery details — after add_to_cart, in the same turn if the details are already known. It does NOT place the order: the customer checks the fields, picks payment and presses the final button on the checkout page themselves. Pass only details the customer actually gave; never invent them.",
    input_schema: {
      type: "object",
      properties: {
        first_name: {
          type: "string",
          description: "Recipient's first name, followed by the patronymic if given (e.g. \"Сергій Миколайович\"). Ukrainian names are often written surname-first (\"Підмогильний Сергій Миколайович\" → first_name \"Сергій Миколайович\", last_name \"Підмогильний\") — split carefully."
        },
        last_name: {
          type: "string",
          description: "Recipient's surname (e.g. \"Підмогильний\")."
        },
        phone: {
          type: "string",
          description: "Recipient's phone number as the customer wrote it."
        },
        city: {
          type: "string",
          description: "City or town for delivery (e.g. \"Дніпро\")."
        },
        delivery_point: {
          type: "string",
          description: "Short Nova Poshta branch or parcel-locker reference, e.g. \"Відділення №87\" or \"Поштомат №1234\", with the street in brackets if given (\"Відділення №87 (просп. Героїв, 50)\"). For courier delivery, the street address."
        },
        email: {
          type: "string",
          description: "Customer's email, only if they gave one."
        }
      }
    }
  }
];

/**
 * Execute a local tool
 * @param {string} toolName - Name of the tool to execute
 * @param {Object} toolArgs - Arguments for the tool
 * @returns {Promise<Object>} Tool execution result
 */
export async function executeLocalTool(toolName, toolArgs) {
  console.log(`Executing local tool: ${toolName}`, toolArgs);

  switch (toolName) {
    case "get_store_info":
      return getStoreInfo(toolArgs);

    case "add_to_cart":
      return addToCart(toolArgs);

    case "prepare_checkout":
      return prepareCheckout(toolArgs);

    default:
      throw new Error(`Unknown local tool: ${toolName}`);
  }
}

/**
 * Get store information
 * @param {Object} args - Tool arguments
 * @returns {Object} Store information
 */
function getStoreInfo(args) {
  // Keep in sync with <store_info> in app/prompts/standard-assistant.txt.
  const storeData = {
    hours: {
      weekdays: "10:00 - 18:00",
      weekends: "Closed",
      timezone: "EET"
    },
    contact: {
      email: "info@informatica.com.ua",
      phone: "+380(99) 381-5288",
      chat: "This chat is available 24/7; Viber & Telegram during working hours"
    },
    shipping: {
      domestic: "Nova Poshta, per carrier pricing",
      processing_time: "1-2 business days"
    },
    returns: "14 days after delivery"
  };

  const { info_type } = args;

  if (info_type === "all") {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(storeData, null, 2)
        }
      ]
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(storeData[info_type] || {}, null, 2)
      }
    ]
  };
}

/**
 * Resolves a variant id to the plain numeric id Shopify's AJAX Cart API
 * (/cart/add.js) expects. Shopify GIDs (e.g. "gid://shopify/ProductVariant/123")
 * encode that same numeric id as their trailing path segment.
 * @param {string} variantId - GID or numeric variant id
 * @returns {string} Numeric variant id
 */
function resolveNumericVariantId(variantId) {
  return String(variantId).split("/").pop();
}

/**
 * Resolves an add-to-cart request. Does not call Shopify directly: the actual
 * cart write happens client-side (via the storefront's real AJAX Cart API) so
 * it lands in the shopper's real browser cart instead of a disconnected one.
 * @param {Object} args - Tool arguments
 * @returns {Object} Tool result, with a cart_action the caller forwards to the client
 */
function addToCart(args) {
  const { variant_id, quantity } = args;
  const numericVariantId = resolveNumericVariantId(variant_id);
  const resolvedQuantity = Number.isInteger(quantity) && quantity > 0 ? quantity : 1;

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          status: "submitted_to_customer_browser",
          variant_id: numericVariantId,
          quantity: resolvedQuantity,
          instructions: "The item is being added to the customer's real cart in their browser right now. Tell the customer it's been added, but don't describe cart totals or contents yourself — you don't have visibility into the real cart's current state. If the customer wants to place the order, call prepare_checkout with their delivery details (or ask for the missing ones) instead of telling them to fill in checkout by hand."
        })
      }
    ],
    cart_action: { variant_id: numericVariantId, quantity: resolvedQuantity }
  };
}

const CHECKOUT_FIELDS = ["first_name", "last_name", "phone", "city", "delivery_point", "email"];
const REQUIRED_CHECKOUT_FIELDS = ["first_name", "last_name", "phone", "city", "delivery_point"];

/**
 * Resolves a checkout-prefill request. Like add_to_cart, it doesn't touch
 * Shopify: the client builds a /checkout?checkout[...] URL from these fields
 * on the shopper's own domain, so it opens their real cart's checkout.
 * @param {Object} args - Tool arguments
 * @returns {Object} Tool result, with a checkout_action the caller forwards to the client
 */
function prepareCheckout(args) {
  const fields = {};
  for (const key of CHECKOUT_FIELDS) {
    const value = typeof args[key] === "string" ? args[key].trim() : "";
    if (value) fields[key] = value;
  }
  const missing = REQUIRED_CHECKOUT_FIELDS.filter((key) => !fields[key]);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          status: "checkout_button_shown",
          prefilled: fields,
          missing,
          instructions: "A 'Перейти до оформлення' button is now shown in the chat; it opens checkout with these details filled in. The order is NOT placed yet — never say it is. Tell the customer to press the button, check the details, choose payment (накладений платіж is the default), tick the confirmation and press «Остаточно оформити замовлення». If anything is listed in missing, briefly ask for it once (they can also type it on the checkout page)."
        })
      }
    ],
    checkout_action: fields
  };
}

export default {
  localTools,
  executeLocalTool
};
