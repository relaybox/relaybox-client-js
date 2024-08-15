export const mockHistoryResponse = {
  messages: [
    {
      body: { message: '16' },
      sender: { clientId: '1234', connectionId: 'M3wLrtCTJe8Z:4NFiw_ue-8oy' },
      timestamp: 1723717620349
    },
    {
      body: { message: '15' },
      sender: { clientId: '1234', connectionId: 'M3wLrtCTJe8Z:4NFiw_ue-8oy' },
      timestamp: 1723717618502
    }
  ],
  nextPageToken: '123'
};

export const mockHistoryNextResponse = {
  messages: [
    {
      body: { message: '16' },
      sender: { clientId: '1234', connectionId: 'M3wLrtCTJe8Z:4NFiw_ue-8oy' },
      timestamp: 1723717720349
    },
    {
      body: { message: '15' },
      sender: { clientId: '1234', connectionId: 'M3wLrtCTJe8Z:4NFiw_ue-8oy' },
      timestamp: 1723717718502
    }
  ],
  nextPageToken: null
};
