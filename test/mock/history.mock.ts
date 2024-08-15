import { HistoryResponse } from '../../lib/types/history.types';

export const mockHistoryResponse: HistoryResponse = {
  messages: [
    {
      body: {
        message: '16'
      },
      sender: {
        clientId: '1234',
        connectionId: 'M3wLrtCTJe8Z:4NFiw_ue-8oy'
      },
      timestamp: 1723717620349
    },
    {
      body: {
        message: '15'
      },
      sender: {
        clientId: '1234',
        connectionId: 'M3wLrtCTJe8Z:4NFiw_ue-8oy'
      },
      timestamp: 1723717618502
    }
  ],
  nextPageToken:
    'eyJrZXkiOiJoaXN0b3J5Om1lc3NhZ2VzOk0zd0xydENUSmU4WjpjaGF0Om9uZTp0ZXN0OjIwMjQtMDgtMTVUMDloIiwibGFzdFNjb3JlIjoxNzIzNzE1NjA5MzA5fQ=='
};

export const mockHistoryNextResponse: HistoryResponse = {
  messages: [
    {
      body: {
        message: '14'
      },
      sender: {
        clientId: '1234',
        connectionId: 'M3wLrtCTJe8Z:4NFiw_ue-8oy'
      },
      timestamp: 1723717720349
    },
    {
      body: {
        message: '13'
      },
      sender: {
        clientId: '1234',
        connectionId: 'M3wLrtCTJe8Z:4NFiw_ue-8oy'
      },
      timestamp: 1723717718502
    }
  ],
  nextPageToken: null
};
