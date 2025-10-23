/**
 * @jest-environment node
 *
 * Integration tests for client management server actions.
 * These tests require Supabase environment variables and use the service role key.
 */

import {
  createClientAction,
  deleteClientAction,
  listClientsAction,
} from '@/app/actions/client-management';
import {
  normalizeClientForm,
  type ClientFormState,
} from '@/lib/client-management';

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(
      `Missing environment variable ${key}. Supabase server-action tests require these credentials.`,
    );
  }
}

describe('Client management server actions', () => {
  let createdClientId: number | null = null;

  afterEach(async () => {
    if (createdClientId) {
      await deleteClientAction(createdClientId);
      createdClientId = null;
    }
  });

  it('creates and deletes a client using Supabase', async () => {
    const uniqueSuffix = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const formState: ClientFormState = {
      name: `Test Client ${uniqueSuffix} `,
      address: '123 Integration Way',
      phoneNumber: '+4611111111',
      email: `client-${uniqueSuffix}@example.com `,
    };

    const payload = normalizeClientForm(formState);

    const createResponse = await createClientAction(payload);
    if (!createResponse.success) {
      throw new Error(
        `createClientAction failed: ${createResponse.error ?? 'unknown error'}`,
      );
    }

    createdClientId = createResponse.clientId;
    expect(createdClientId).toBeGreaterThan(0);

    const listResponse = await listClientsAction();
    if (!listResponse.success) {
      throw new Error(
        `listClientsAction failed: ${listResponse.error ?? 'unknown error'}`,
      );
    }

    const createdRecord = listResponse.data.find(
      (client) => client.id === createdClientId,
    );

    expect(createdRecord).toBeDefined();
    expect(createdRecord?.email).toBe(payload.email);
    expect(createdRecord?.name).toBe(payload.name);

    const deleteResponse = await deleteClientAction(createdClientId);
    expect(deleteResponse.success).toBe(true);

    createdClientId = null;

    const listAfterDelete = await listClientsAction();
    if (!listAfterDelete.success) {
      throw new Error(
        `listClientsAction (after delete) failed: ${
          listAfterDelete.error ?? 'unknown error'
        }`,
      );
    }

    expect(listAfterDelete.data.some((client) => client.id === createResponse.clientId)).toBe(false);
  });
});
