import type { EventRequestStatus } from "@/lib/event-request-config";

export const EVENT_TYPES = [
  "CONFERENCE",
  "WORKSHOP",
  "CONCERT",
  "WEDDING",
  "OTHER",
] as const;

export const EVENT_PREFERENCES = [
  "DECORATION",
  "FILMING",
  "BREAKFAST",
  "LUNCH",
  "DINNER",
  "BEVERAGE",
  "PHOTOGRAPHY",
  "MUSIC",
  "GRAPHIC_DESIGN",
  "WAITER",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];
export type EventPreference = (typeof EVENT_PREFERENCES)[number];

export type ClientSummary = {
  id: number;
  name: string;
  email: string | null;
  phone_number: string | null;
};

export type SubmitterSummary = {
  id: string;
  username: string | null;
  email: string | null;
};

export type EventRequestRecord = {
  id: number;
  client_id: number;
  client: ClientSummary | null;
  event_type: EventType;
  status: EventRequestStatus;
  start_time: string;
  finish_time: string;
  location: string | null;
  preferences: EventPreference[] | null;
  note: string | null;
  submitter_id: string;
  submitter: SubmitterSummary | null;
  created_at: string;
};

export type EventRequestFormState = {
  clientId: string;
  eventType: EventType;
  startTime: string;
  finishTime: string;
  location: string;
  preferences: EventPreference[];
  note: string;
};

export type CreateEventRequestInput = {
  clientId: number;
  eventType: EventType;
  startTime: string;
  finishTime: string;
  location: string;
  note: string;
  preferences: EventPreference[];
  submitterId: string;
};

export type EventRequestInsertPayload = {
  client_id: number;
  event_type: EventType;
  start_time: string;
  finish_time: string;
  location: string | null;
  preferences: EventPreference[];
  note: string | null;
  submitter_id: string;
  status: EventRequestStatus;
};

export type ValidateEventRequestFormResult =
  | { ok: true; message: null }
  | { ok: false; message: string };

export const EVENT_REQUEST_SELECT_FIELDS = `
  id,
  client_id,
  client:client_id ( id, name, email, phone_number ),
  submitter:submitter_id ( id, username, email ),
  event_type,
  status,
  start_time,
  finish_time,
  location,
  preferences,
  note,
  submitter_id,
  created_at
`;

export function validateEventRequestForm(
  form: EventRequestFormState,
): ValidateEventRequestFormResult {
  if (!form.clientId || Number.isNaN(Number(form.clientId))) {
    return { ok: false, message: "Please select a client before submitting." };
  }

  if (!form.startTime || !form.finishTime) {
    return {
      ok: false,
      message: "Start time and finish time are required.",
    };
  }

  return { ok: true, message: null };
}

export function buildCreateEventRequestInput(
  form: EventRequestFormState,
  submitterId: string,
): CreateEventRequestInput {
  const start = new Date(form.startTime);
  const finish = new Date(form.finishTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(finish.getTime())) {
    throw new Error("Invalid start or finish time supplied.");
  }

  return {
    clientId: Number(form.clientId),
    eventType: form.eventType,
    startTime: start.toISOString(),
    finishTime: finish.toISOString(),
    location: form.location,
    note: form.note,
    preferences: form.preferences,
    submitterId,
  };
}

export function buildEventRequestInsertPayload(
  input: CreateEventRequestInput,
): EventRequestInsertPayload {
  return {
    client_id: input.clientId,
    event_type: input.eventType,
    start_time: input.startTime,
    finish_time: input.finishTime,
    location: input.location.trim() || null,
    note: input.note.trim() || null,
    preferences: input.preferences,
    submitter_id: input.submitterId,
    status: "DRAFT",
  };
}

export function mapEventRequestRow(
  row: Record<string, unknown>,
): EventRequestRecord {
  return {
    id: row.id as number,
    client_id: row.client_id as number,
    client: unwrapRelation<ClientSummary>(row.client),
    event_type: row.event_type as EventType,
    status: normalizeStatus(row.status),
    start_time: row.start_time as string,
    finish_time: row.finish_time as string,
    location: (row.location as string | null | undefined) ?? null,
    preferences: (row.preferences as EventPreference[] | null | undefined) ?? null,
    note: (row.note as string | null | undefined) ?? null,
    submitter_id: row.submitter_id as string,
    submitter: unwrapRelation<SubmitterSummary>(row.submitter),
    created_at: row.created_at as string,
  };
}

export function normalizeStatus(value: unknown): EventRequestStatus {
  if (typeof value !== "string") {
    return "DRAFT";
  }

  const upper = value.toUpperCase();
  if (
    upper === "DRAFT" ||
    upper === "PENDING" ||
    upper === "REJECTED" ||
    upper === "OPEN"
  ) {
    return upper as EventRequestStatus;
  }

  return "DRAFT";
}

export function unwrapRelation<T>(value: unknown): T | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return (value[0] ?? null) as T | null;
  }

  return value as T;
}
