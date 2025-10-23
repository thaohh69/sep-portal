/**
 * @jest-environment node
 *
 * Integration tests for event request server actions using Supabase service role.
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TEST_CUSTOMER_SERVICE_USER.
 */

import {
  createEventRequestAction,
  listEventRequestsAction,
  reviewEventRequestAction,
  updateEventRequestStatusAction,
} from '@/app/actions/event-requests';
import {
  createClientAction,
  deleteClientAction,
} from '@/app/actions/client-management';
import {
  buildCreateEventRequestInput,
  type EventRequestFormState,
} from '@/lib/event-request';
import { createAdminClient } from '@/lib/supabase/admin';
import type {
  EventRequestReviewStep,
  EventRequestStatus,
} from '@/lib/event-request-config';

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'TEST_CUSTOMER_SERVICE_USER',
] as const;

for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(
      `Missing environment variable ${key}. Supabase event request action tests require these credentials.`,
    );
  }
}

async function resolveStaffId(email: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('staff_profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.id) {
    throw new Error(`Unable to resolve staff profile for ${email}`);
  }

  return data.id as string;
}

describe('Event request server actions', () => {
  let createdClientId: number | null = null;
  let createdEventRequestId: number | null = null;

  const cleanupEventRequest = async () => {
    if (!createdEventRequestId) return;
    const supabase = createAdminClient();
    await supabase
      .from('event_request')
      .delete()
      .eq('id', createdEventRequestId);
    createdEventRequestId = null;
  };

  afterEach(async () => {
    await cleanupEventRequest();

    if (createdClientId) {
      await deleteClientAction(createdClientId);
      createdClientId = null;
    }
  });

  it('creates an event request and updates its status', async () => {
    const uniqueSuffix = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const clientPayload = {
      name: `Event Flow Test Client ${uniqueSuffix}`,
      address: '1 Event Lane',
      phone_number: '+46123456789',
      email: `event-flow-client-${uniqueSuffix}@example.com`,
    };

    const clientResponse = await createClientAction({
      ...clientPayload,
    });

    if (!clientResponse.success || !clientResponse.clientId) {
      throw new Error(
        `createClientAction failed: ${clientResponse.error ?? 'unknown error'}`,
      );
    }

    createdClientId = clientResponse.clientId;

    const submitterEmail = process.env.TEST_CUSTOMER_SERVICE_USER!;
    const submitterId = await resolveStaffId(submitterEmail);

    const now = Date.now();
    const start = new Date(now + 5 * 60 * 1000).toISOString();
    const finish = new Date(now + 65 * 60 * 1000).toISOString();

    const formState: EventRequestFormState = {
      clientId: String(createdClientId),
      eventType: 'CONFERENCE',
      startTime: start,
      finishTime: finish,
      location: 'Main Hall',
      preferences: ['DECORATION', 'DINNER'],
      note: `Server action integration test ${uniqueSuffix}`,
    };

    const createPayload = buildCreateEventRequestInput(formState, submitterId);

    const createResponse = await createEventRequestAction(createPayload);
    if (!createResponse.success || !createResponse.record) {
      throw new Error(
        `createEventRequestAction failed: ${
          createResponse.error ?? 'unknown error'
        }`,
      );
    }

    createdEventRequestId = createResponse.record.id;

    expect(createResponse.record.client_id).toBe(createdClientId);
    expect(createResponse.record.status).toBe('DRAFT');
    expect(createResponse.record.event_type).toBe('CONFERENCE');

    const nextStatus: EventRequestStatus = 'PENDING';
    const updateResponse = await updateEventRequestStatusAction(
      createdEventRequestId,
      nextStatus,
    );
    expect(updateResponse.success).toBe(true);

    const listResponse = await listEventRequestsAction();
    if (!listResponse.success) {
      throw new Error(
        `listEventRequestsAction failed: ${
          listResponse.error ?? 'unknown error'
        }`,
      );
    }

    let updatedRecord = listResponse.data.find(
      (request) => request.id === createdEventRequestId,
    );

    expect(updatedRecord).toBeDefined();
    expect(updatedRecord?.status).toBe(nextStatus);
    expect(updatedRecord?.review_step).toBe('FINANCIAL_MANAGER');

    const reviewSteps: EventRequestReviewStep[] = [
      'FINANCIAL_MANAGER',
      'ADMINISTRATION_MANAGER',
      'CUSTOMER_MEETING',
    ];

    for (const step of reviewSteps) {
      const decisionResponse = await reviewEventRequestAction(
        createdEventRequestId,
        step,
        'APPROVE',
      );
      expect(decisionResponse.success).toBe(true);

      const checkpointResponse = await listEventRequestsAction();
      if (!checkpointResponse.success) {
        throw new Error(
          `listEventRequestsAction failed: ${
            checkpointResponse.error ?? 'unknown error'
          }`,
        );
      }

      updatedRecord = checkpointResponse.data.find(
        (request) => request.id === createdEventRequestId,
      );

      expect(updatedRecord).toBeDefined();

      if (step === 'FINANCIAL_MANAGER') {
        expect(updatedRecord?.status).toBe('PENDING');
        expect(updatedRecord?.review_step).toBe('ADMINISTRATION_MANAGER');
      } else if (step === 'ADMINISTRATION_MANAGER') {
        expect(updatedRecord?.status).toBe('PENDING');
        expect(updatedRecord?.review_step).toBe('CUSTOMER_MEETING');
      } else {
        expect(updatedRecord?.status).toBe('APPROVED');
        expect(updatedRecord?.review_step).toBeNull();
      }
    }
  });
});
