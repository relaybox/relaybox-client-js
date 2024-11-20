import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { setupServer } from 'msw/node';
import { HttpResponse, http } from 'msw';
import { Intellect } from '../lib/intellect';

const mockIntellectServiceUrl = process.env.INTELLECT_SERVICE_URL || '';
const mockRoomid = 'room123';
const mockAuthtoken = 'auth-token';

const server = setupServer();

interface IntellectRequestBody {
  input: string;
  roomId: string;
  conversationId?: string;
}

function getMockApiErrorResponse() {
  return HttpResponse.json(
    { name: 'Error', message: 'failed', data: { schema: false } },
    { status: 400 }
  );
}

vi.mock('../lib/logger', () => ({
  logger: {
    logInfo: vi.fn(),
    logError: vi.fn()
  }
}));

describe('Intellect', () => {
  beforeAll(() => {
    server.use(
      http.post<never, IntellectRequestBody, any>(
        `${mockIntellectServiceUrl}/queries`,
        async ({ request }) => {
          const bearerToken = request.headers.get('Authorization')?.substring(7);

          if (bearerToken) {
            return HttpResponse.json({
              response: 'success',
              conversationId: 'conversation-id'
            });
          }

          return getMockApiErrorResponse();
        }
      )
    );

    server.listen();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
  });

  afterAll(() => {
    server.close();
    vi.restoreAllMocks();
  });

  describe('query', () => {
    describe('success', () => {
      it('should successfully query', async () => {
        const mockGetTokenResponse = vi.fn().mockReturnValueOnce(mockAuthtoken);

        const intellect = new Intellect(
          mockRoomid,
          mockIntellectServiceUrl,
          vi.fn(),
          mockGetTokenResponse
        );

        await expect(intellect.query('test-input')).resolves.toEqual(
          expect.objectContaining({
            response: 'success',
            conversationId: 'conversation-id'
          })
        );
      });
    });

    describe('error', () => {
      it('throw an error if no auth token is found', async () => {
        const mockGetTokenResponse = vi.fn().mockReturnValueOnce(null);

        const intellect = new Intellect(
          mockRoomid,
          mockIntellectServiceUrl,
          vi.fn(),
          mockGetTokenResponse
        );

        await expect(intellect.query('test-input')).rejects.toThrowError();
      });
    });
  });
});
