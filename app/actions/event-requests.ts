'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  EVENT_REQUEST_SELECT_FIELDS,
  buildEventRequestInsertPayload,
  mapEventRequestRow,
  normalizeReviewStep,
  normalizeStatus,
  type CreateEventRequestInput,
  type EventRequestRecord,
} from '@/lib/event-request';
import {
  EVENT_REQUEST_REVIEW_STEPS,
  type EventRequestReviewStep,
  type EventRequestStatus,
} from '@/lib/event-request-config';

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

export type ReviewEventRequestDecision = 'APPROVE' | 'REJECT';

const FEEDBACK_COLUMN_BY_STEP: Record<EventRequestReviewStep, keyof EventRequestRecord> =
  {
    FINANCIAL_MANAGER: 'financial_manager_feedback',
    ADMINISTRATION_MANAGER: 'administration_manager_feedback',
    CUSTOMER_MEETING: 'customer_meeting_feedback',
  };

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
  options?: { feedback?: string },
): Promise<UpdateEventRequestStatusResult> {
  const supabase = createAdminClient();

  const updates: Record<string, unknown> = {
    status: nextStatus,
  };

  const feedback =
    typeof options?.feedback === 'string'
      ? options.feedback.trim() || null
      : null;

  if (nextStatus === 'PENDING') {
    updates.review_step = 'FINANCIAL_MANAGER';
    updates.scso_feedback = feedback;
  } else {
    updates.review_step = null;
    updates.scso_feedback = feedback;
  }

  const { error } = await supabase
    .from(EVENT_REQUEST_TABLE)
    .update(updates)
    .eq('id', requestId);

  if (error) {
    console.error('[updateEventRequestStatusAction] Failed to update event request status', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function reviewEventRequestAction(
  requestId: number,
  reviewStep: EventRequestReviewStep,
  decision: ReviewEventRequestDecision,
  options?: { feedback?: string },
): Promise<UpdateEventRequestStatusResult> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(EVENT_REQUEST_TABLE)
    .select('status, review_step')
    .eq('id', requestId)
    .maybeSingle();

  if (error) {
    console.error('[reviewEventRequestAction] Failed to fetch event request state', error);
    return { success: false, error: error.message };
  }

  if (!data) {
    return { success: false, error: 'Event request not found.' };
  }

  const currentStatus = normalizeStatus((data as Record<string, unknown>).status);
  const currentReviewStep = normalizeReviewStep((data as Record<string, unknown>).review_step);

  if (currentStatus !== 'PENDING') {
    return {
      success: false,
      error: 'Event request is not pending review.',
    };
  }

  if (currentReviewStep !== reviewStep) {
    return {
      success: false,
      error: 'Review step mismatch. Refresh and try again.',
    };
  }

  const stepIndex = EVENT_REQUEST_REVIEW_STEPS.findIndex(
    (step) => step.key === reviewStep,
  );

  if (stepIndex === -1) {
    return {
      success: false,
      error: 'Invalid review step provided.',
    };
  }

  let statusUpdate: EventRequestStatus;
  let nextStep: EventRequestReviewStep | null;

  if (decision === 'REJECT') {
    statusUpdate = 'REJECTED';
    nextStep = null;
  } else {
    const hasNext = stepIndex + 1 < EVENT_REQUEST_REVIEW_STEPS.length;
    if (hasNext) {
      statusUpdate = 'PENDING';
      nextStep = EVENT_REQUEST_REVIEW_STEPS[stepIndex + 1]?.key ?? null;
    } else {
      statusUpdate = 'APPROVED';
      nextStep = null;
    }
  }

  const feedbackColumn = FEEDBACK_COLUMN_BY_STEP[reviewStep];
  const feedbackValue =
    typeof options?.feedback === 'string'
      ? options.feedback.trim() || null
      : null;

  const { error: updateError } = await supabase
    .from(EVENT_REQUEST_TABLE)
    .update({
      status: statusUpdate,
      review_step: nextStep,
      [feedbackColumn]: feedbackValue,
    })
    .eq('id', requestId);

  if (updateError) {
    console.error('[reviewEventRequestAction] Failed to update review step', updateError);
    return { success: false, error: updateError.message };
  }

  return { success: true };
}
