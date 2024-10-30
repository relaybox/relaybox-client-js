import { faker } from '@faker-js/faker';

export const mockHistoryResponse = {
  messages: [
    {
      timestamp: 1723717620349
    },
    {
      timestamp: 1723717618550
    }
  ],
  nextPageToken: '123'
};

export const mockHistoryNextResponse = {
  messages: [
    {
      timestamp: 1723717720351
    },
    {
      timestamp: 1723717718552
    }
  ],
  nextPageToken: null
};

export function getMockHistoryMessage() {
  return {
    id: faker.string.uuid(),
    body: {},
    sender: {
      clientId: faker.string.alphanumeric(12),
      connectionId: `${faker.string.alphanumeric(12)}:${faker.string.alphanumeric(12)}`,
      user: {}
    },
    timestamp: Date.now(),
    event: 'custom'
  };
}

export function getMockHistoryResponse(count: number = 1) {
  const data = Array.from({ length: count }, () => getMockHistoryMessage());

  return {
    count: 2,
    data
  };
}
