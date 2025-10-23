'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  EVENT_REQUEST_SELECT_FIELDS,
  buildEventRequestInsertPayload,
  mapEventRequestRow,
  type CreateEventRequestInput,
  type EventRequestRecord,
} from '@/lib/event-request';
import type { EventRequestStatus } from '@/lib/event-request-config';

const EVENT_REQUEST_TABLE = 'event_request';

type BaseActionResult = {
  success: boolean;
  error?: string;
};

export type ListEventRequestsResult = BaseActionResult & {
  data: EventRequestRecord[];
};

export type CreateEventRequestResult = BaseActionResult & {
  record?: EventRequestRecord;
};

export type UpdateEventRequestStatusResult = BaseActionResult;

export async function listEventRequestsAction(): Promise<ListEventRequestsResult> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(EVENT_REQUEST_TABLE)
    .select(EVENT_REQUEST_SELECT_FIELDS)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[listEventRequestsAction] Failed to fetch event requests', error);
    return { success: false, error: error.message, data: [] };
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  return {
    success: true,
    data: rows.map(mapEventRequestRow),
  };
}

export async function createEventRequestAction(
  input: CreateEventRequestInput,
): Promise<CreateEventRequestResult> {
  const supabase = createAdminClient();
  const payload = buildEventRequestInsertPayload(input);

  const { data, error } = await supabase
    .from(EVENT_REQUEST_TABLE)
    .insert(payload)
    .select(EVENT_REQUEST_SELECT_FIELDS)
    .single();

  if (error) {
    console.error('[createEventRequestAction] Failed to create event request', error);
    return { success: false, error: error.message };
  }

  const record = mapEventRequestRow(data as Record<string, unknown>);
  return { success: true, record };
}

export async function updateEventRequestStatusAction(
  requestId: number,
  nextStatus: EventRequestStatus,
): Promise<UpdateEventRequestStatusResult> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from(EVENT_REQUEST_TABLE)
    .update({ status: nextStatus })
    .eq('id', requestId);

  if (error) {
    console.error('[updateEventRequestStatusAction] Failed to update event request status', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
