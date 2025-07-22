export const endpoints = {
  getEventInfo: (channelSlug, eventSqid) =>
    `/shop/v2/${channelSlug}/${eventSqid}`,
  createOrder: `/shop/v1/orders/primary`,
  getOrder: (orderId) => `/shop/v1/orders/${orderId}`,
  updateTicket: (orderId, ticketId) =>
    `/shop/v1/orders/${orderId}/tickets/${ticketId}`,
  prepareOrder: (orderId) => `/shop/v1/orders/${orderId}/prepare`,
};
