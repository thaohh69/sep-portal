"use client";

import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";
import {
  EVENT_REQUEST_STATUSES,
  type EventRequestStatus,
} from "@/lib/event-request-config";

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
  client?: ClientSummary | null;
  event_type: EventType;
  status: EventRequestStatus;
  start_time: string;
  finish_time: string;
  location: string | null;
  preferences: EventPreference[] | null;
  note: string | null;
  submitter_id: string;
  submitter?: SubmitterSummary | null;
  created_at: string;
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

function ensureSupabase() {
  if (!hasEnvVars) {
    throw new Error(
      "Supabase environment variables are not configured. Contact an administrator.",
    );
  }

  return createClient();
}

export async function listEventRequests(): Promise<EventRequestRecord[]> {
  const supabase = ensureSupabase();
  const { data, error } = await supabase
    .from("event_request")
    .select(
      `
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
      `,
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const records = (data ?? []) as Record<string, unknown>[];

  return records.map((row) => ({
    ...row,
    client: unwrapRelation<ClientSummary>(row.client),
    submitter: unwrapRelation<SubmitterSummary>(row.submitter),
    status: normalizeStatus(row.status),
  })) as EventRequestRecord[];
}

export async function getEventRequest(
  id: number,
): Promise<EventRequestRecord | null> {
  const supabase = ensureSupabase();
  const { data, error } = await supabase
    .from("event_request")
    .select(
      `
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
      `,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const record = data as Record<string, unknown>;
  return {
    ...record,
    client: unwrapRelation<ClientSummary>(record.client),
    submitter: unwrapRelation<SubmitterSummary>(record.submitter),
    status: normalizeStatus(record.status),
  } as EventRequestRecord;
}

export async function createEventRequest(
  input: CreateEventRequestInput,
): Promise<EventRequestRecord> {
  const supabase = ensureSupabase();

  const payload = {
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

  const { data, error } = await supabase
    .from("event_request")
    .insert(payload)
    .select(
      `
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
      `,
    )
    .single();

  if (error) {
    throw error;
  }

  const record = data as Record<string, unknown>;
  return {
    ...record,
    client: unwrapRelation<ClientSummary>(record.client),
    submitter: unwrapRelation<SubmitterSummary>(record.submitter),
    status: normalizeStatus(record.status),
  } as EventRequestRecord;
}

export async function updateEventRequestStatus(
  id: number,
  status: EventRequestStatus,
) {
  const supabase = ensureSupabase();
  const { data, error } = await supabase
    .from("event_request")
    .update({ status })
    .eq("id", id)
    .select(
      `
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
      `,
    )
    .single();

  if (error) {
    throw error;
  }

  const record = data as Record<string, unknown>;
  return {
    ...record,
    client: unwrapRelation<ClientSummary>(record.client),
    submitter: unwrapRelation<SubmitterSummary>(record.submitter),
    status: normalizeStatus(record.status),
  } as EventRequestRecord;
}

function normalizeStatus(
  value: unknown,
): EventRequestStatus {
  const fallback: EventRequestStatus = "DRAFT";
  if (typeof value !== "string") {
    return fallback;
  }
  const upper = value.toUpperCase();
  return (EVENT_REQUEST_STATUSES.find((status) => status === upper) ??
    fallback) as EventRequestStatus;
}

function unwrapRelation<T>(value: unknown): T | null {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return (value[0] ?? null) as T | null;
  }
  return value as T;
}
