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
    id: 'd8148d81-3139-4ffc-b353-68a24b6afaec',
    body: {
      message: '3'
    },
    sender: {
      clientId: 'CitCsVzOsNMi',
      connectionId: 'bWT2vLnVmvaL:IF96unfsKo4-',
      user: {
        id: '5d84bd63-da65-4f15-854c-7d8387db2bdf',
        clientId: 'CitCsVzOsNMi',
        createdAt: '2024-10-17T09:34:28.798829',
        username: 'KeyCrayfish580',
        isOnline: true,
        lastOnline: '2024-10-30T10:31:56.091',
        blockedAt: null,
        firstName: null,
        lastName: null
      }
    },
    timestamp: 1730212184585,
    event: 'custom'
  };
}

export function getMockHistoryResponse() {
  return {
    count: 2,
    data: [getMockHistoryMessage()]
  };
}
