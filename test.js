// k6-ticket-loop-test.js

import http from "k6/http";
import { check, sleep } from "k6";
import { uuidv4 } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

export const options = {
  stages: [
    { duration: "1m", target: 1000 },
    { duration: "1m", target: 1000 },
    { duration: "1m", target: 0 },
  ],
};

const BASE_URL = "https://api-staging.celebratix.io";
const EVENT_SQID = "e_wmkmd";
const CHANNEL_SLUG = "gejay";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.5735.199 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "Content-Type": "application/json",
  "X-Bypass-Key": "your-secret-value-eduardo",
};

const TICKETS_TO_TEST = [
  { id: "dbb01378-13d6-4cfc-90dd-0d13879e89a7", name: "Ticket A" },
  { id: "3a6f52ae-d2aa-4d7c-a1b9-09711bba07aa", name: "Ticket Delta" },
  {
    id: "b7a9a2dd-7c7d-45a7-a93d-d01cd32d161e",
    name: "Early Bird (Sold Out)",
    soldOut: true,
  },
];

const orderMap = {};

export default function () {
  const eventRes = http.get(
    `${BASE_URL}/shop/v2/${CHANNEL_SLUG}/${EVENT_SQID}`,
    { headers: HEADERS }
  );
  check(eventRes, { "event info status is 200": (r) => r.status === 200 });

  let eventJson;
  try {
    eventJson = eventRes.json();
  } catch (e) {
    console.error("❌ Failed to parse event JSON. Status:", eventRes.status);
    console.error("Body:", eventRes.body);
    return;
  }

  const ticketDict = eventJson.ticketTypeDictionary || {};

  if (__ITER === 0) {
    const initTicket = TICKETS_TO_TEST.find(
      (t) => ticketDict[t.id] && ticketDict[t.id].status === "OnSale"
    );
    if (!initTicket) return;

    const delta = ticketDict[initTicket.id].deltaTicketsPerPurchase || 1;

    const orderRes = http.post(
      `${BASE_URL}/shop/v1/orders/primary`,
      JSON.stringify({
        ticketTypeId: initTicket.id,
        ticketQuantity: delta,
        channelSlug: CHANNEL_SLUG,
        trackingLinkCode: null,
        loyaltyLinkCode: null,
      }),
      { headers: HEADERS }
    );

    check(orderRes, {
      "order creation status is 200": (r) => r.status === 200,
    });
    const orderId = orderRes.json().orderId;
    if (!orderId) return;

    orderMap[__VU] = { orderId, guid: uuidv4() };
    console.log(`✅ Order created: ${orderId}`);
    return;
  }

  const session = orderMap[__VU];
  if (!session) return;
  const { orderId, guid } = session;

  const orderStateRes = http.get(`${BASE_URL}/shop/v1/orders/${orderId}`, {
    headers: HEADERS,
  });
  check(orderStateRes, {
    "order state status is 200": (r) => r.status === 200,
  });

  const orderState = orderStateRes.json();
  const existingTicketTypeIds = (orderState.orderLines || []).map(
    (line) => line.ticketTypeId
  );

  const loopIndex = __ITER;

  let ticket;
  if (loopIndex % 10 === 0) {
    ticket = TICKETS_TO_TEST.find((t) => t.soldOut);
  } else {
    const availableTickets = TICKETS_TO_TEST.filter((t) => !t.soldOut);
    ticket =
      availableTickets[Math.floor(Math.random() * availableTickets.length)];
  }

  const info = ticketDict[ticket.id];
  if (!info) return;

  const delta = info.deltaTicketsPerPurchase || 1;
  let quantity;

  if (ticket.soldOut) {
    quantity = delta;
  } else {
    const alreadyInOrder = existingTicketTypeIds.includes(ticket.id);
    const action = Math.random() > 0.5 ? "add" : "remove";
    if (action === "remove" && !alreadyInOrder) return;
    quantity = action === "add" ? delta : 0;
  }

  console.log(
    `${quantity > 0 ? "➕ Add" : "➖ Remove"} ticket: ${ticket.name}`
  );

  const res = http.post(
    `${BASE_URL}/shop/v1/orders/${orderId}/tickets/${ticket.id}`,
    JSON.stringify({ ticketQuantity: quantity }),
    { headers: HEADERS }
  );

  const isExpected = ticket.soldOut
    ? res.status === 422
    : res.status === 200 || res.status === 422;
  check(res, { "ticket update status": () => isExpected });

  const updatedOrderStateRes = http.get(
    `${BASE_URL}/shop/v1/orders/${orderId}`,
    { headers: HEADERS }
  );
  check(updatedOrderStateRes, {
    "updated order state status is 200": (r) => r.status === 200,
  });

  const updatedOrderState = updatedOrderStateRes.json();
  const hasTickets = (updatedOrderState.orderLines || []).length > 0;

  if (loopIndex % 5 === 0 && hasTickets) {
    const prepRes = http.post(
      `${BASE_URL}/shop/v1/orders/${orderId}/prepare`,
      JSON.stringify({
        firstName: guid.substring(0, 8),
        lastName: guid.substring(9, 13),
        emailAddress: `${guid}@gmail.com`,
        city: null,
        dateOfBirth: null,
        gender: null,
      }),
      { headers: HEADERS }
    );

    check(prepRes, { "repeat prepare order status": (r) => r.status === 200 });
    console.log(`🔁 Prepared again: ${orderId}`);
  }

  sleep(2);
}
