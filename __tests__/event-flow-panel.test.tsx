/**
 * Integration test: create an event request through the UI and ensure it appears in the list.
 * Requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, TEST_USER, TEST_PW.
 */

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { AuthProvider } from "@/context/auth-context";
import { EventFlowPanel } from "@/components/event-flow-panel";
import { hasEnvVars } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

if (!hasEnvVars) {
  throw new Error(
    "Supabase environment variables are required for event request tests.",
  );
}

jest.setTimeout(30000);

function formatDateInput(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildClientPayload() {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    name: `Event Test Client ${unique}`,
    address: "1 Event Plaza",
    phone_number: "+4611111111",
    email: `event-test-client-${unique}@example.com`,
  };
}

function buildEventPayload() {
  const now = new Date();
  const start = new Date(now.getTime() + 5 * 60 * 1000);
  const finish = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    eventType: "CONFERENCE",
    start,
    finish,
    location: "Main Hall",
    note: `Automated test note ${now.getTime()}`,
  };
}

async function signInIfNeeded() {
  const supabase = createClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (!session) {
    const email = process.env.TEST_USER;
    const password = process.env.TEST_PW;
    if (!email || !password) {
      throw new Error(
        "Event request UI tests require TEST_USER and TEST_PW credentials.",
      );
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      throw signInError;
    }
  }
}

async function cleanupEventRequests(
  clientId: number | null,
  supabase: ReturnType<typeof createClient>,
) {
  if (!clientId) return;
  await supabase.from("event_request").delete().eq("client_id", clientId);
  await supabase.from("client").delete().eq("id", clientId);
}

describe("EventFlowPanel UI integration", () => {
  beforeAll(async () => {
    await signInIfNeeded();
  });

  it("creates an event request and shows it in the list", async () => {
    const supabase = createClient();
    const clientPayload = buildClientPayload();
    const eventPayload = buildEventPayload();

    const { data: insertedClient, error: clientError } = await supabase
      .from("client")
      .insert(clientPayload)
      .select("id, name")
      .single();

    if (clientError) {
      throw clientError;
    }

    const clientId = insertedClient?.id ?? null;
    if (!clientId) {
      throw new Error("Client insert did not return an id.");
    }

    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );
    const { unmount } = render(<EventFlowPanel />, { wrapper });

    try {
      await waitFor(() => {
        expect(screen.queryByText(/Loading event requests/i)).toBeNull();
      });

      fireEvent.click(screen.getByRole("button", { name: /new event request/i }));

      fireEvent.change(screen.getByLabelText(/client/i), {
        target: { value: String(clientId) },
      });
      fireEvent.change(screen.getByLabelText(/event type/i), {
        target: { value: eventPayload.eventType },
      });
      fireEvent.change(screen.getByLabelText(/start time/i), {
        target: { value: formatDateInput(eventPayload.start) },
      });
      fireEvent.change(screen.getByLabelText(/finish time/i), {
        target: { value: formatDateInput(eventPayload.finish) },
      });
      fireEvent.change(screen.getByLabelText(/location/i), {
        target: { value: eventPayload.location },
      });
      fireEvent.change(screen.getByLabelText(/notes/i), {
        target: { value: eventPayload.note },
      });

      const saveButton = screen.getByRole("button", { name: /create/i });
      fireEvent.click(saveButton);

      await waitFor(() =>
        expect(screen.queryByLabelText(/notes/i)).not.toBeInTheDocument(),
      );

      await waitFor(() =>
        expect(screen.getByText(insertedClient.name)).toBeInTheDocument(),
      );

      const { data: createdEvents, error: eventError } = await supabase
        .from("event_request")
        .select("id, note")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (eventError) {
        throw eventError;
      }

      expect(createdEvents?.some((row) => row.note === eventPayload.note)).toBe(
        true,
      );
    } finally {
      await cleanupEventRequests(clientId, supabase);
      unmount();
    }
  });
});
