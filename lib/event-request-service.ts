"use client";

import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";

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
  status: string;
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

  return ((data ?? []) as unknown) as EventRequestRecord[];
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

  return (data as unknown as EventRequestRecord | null) ?? null;
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

  return data as unknown as EventRequestRecord;
}
