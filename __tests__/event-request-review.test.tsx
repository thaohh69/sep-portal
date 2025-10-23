/**
 * Integration tests for event request review actions (approve / reject).
 * Requires the following environment variables:
 *  - NEXT_PUBLIC_SUPABASE_URL
 *  - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 *  - TEST_CUSTOMER_SERVICE_USER
 *  - TEST_CUSTOMER_SERVICE_PW
 *  - TEST_SENIOR_USER
 *  - TEST_SENIOR_PW
 */

import type { ReactNode } from "react";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import { AuthProvider } from "@/context/auth-context";
import { EventFlowPanel } from "@/components/event-flow-panel";
import { hasEnvVars } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

if (
  !hasEnvVars ||
  !process.env.TEST_CUSTOMER_SERVICE_USER ||
  !process.env.TEST_CUSTOMER_SERVICE_PW ||
  !process.env.TEST_SENIOR_USER ||
  !process.env.TEST_SENIOR_PW
) {
  throw new Error(
    "Missing Supabase environment variables or test credentials. Ensure NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, TEST_CUSTOMER_SERVICE_USER, TEST_CUSTOMER_SERVICE_PW, TEST_SENIOR_USER, TEST_SENIOR_PW are set.",
  );
}

jest.setTimeout(40000);

type SupabaseClient = ReturnType<typeof createClient>;

function formatIso(date: Date) {
  return date.toISOString();
}

function buildClientPayload() {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    name: `Review Test Client ${unique}`,
    address: "Review Street 1",
    phone_number: "+4612340000",
    email: `review-client-${unique}@example.com`,
  };
}

function buildEventPayload() {
  const now = new Date();
  const start = new Date(now.getTime() + 10 * 60 * 1000);
  const finish = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    event_type: "CONFERENCE",
    start_time: formatIso(start),
    finish_time: formatIso(finish),
    location: "Review Hall",
    note: `Review automation note ${now.getTime()}`,
    preferences: ["DECORATION"],
  };
}

async function signIn(
  supabase: SupabaseClient,
  email: string,
  password: string,
) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }
}

async function ensureSignedOut(supabase: SupabaseClient) {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

async function seedDraftRequest(
  supabase: SupabaseClient,
  submitterEmail: string,
  submitterPassword: string,
) {
  await signIn(supabase, submitterEmail, submitterPassword);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  if (!user) {
    throw new Error("Unable to resolve submitter profile for test user.");
  }

  const clientPayload = buildClientPayload();
  const { data: client, error: clientError } = await supabase
    .from("client")
    .insert(clientPayload)
    .select("id, name")
    .single();

  if (clientError) {
    throw clientError;
  }

  const eventPayload = buildEventPayload();

  const { data: event, error: eventError } = await supabase
    .from("event_request")
    .insert({
      client_id: client.id,
      event_type: eventPayload.event_type,
      start_time: eventPayload.start_time,
      finish_time: eventPayload.finish_time,
      location: eventPayload.location,
      note: eventPayload.note,
      preferences: eventPayload.preferences,
      submitter_id: user.id,
      status: "DRAFT",
    })
    .select("id, status, note")
    .single();

  if (eventError) {
    throw eventError;
  }

  await ensureSignedOut(supabase);

  return {
    clientId: client.id,
    clientName: client.name,
    eventId: event.id as number,
    note: event.note as string,
  };
}

async function cleanupTestData(
  supabase: SupabaseClient,
  eventId: number,
  clientId: number,
) {
  await supabase.from("event_request").delete().eq("id", eventId);
  await supabase.from("client").delete().eq("id", clientId);
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe("Event request review actions", () => {
  const supabase = createClient();
  const customerEmail = process.env.TEST_CUSTOMER_SERVICE_USER!;
  const customerPassword = process.env.TEST_CUSTOMER_SERVICE_PW!;
  const seniorEmail = process.env.TEST_SENIOR_USER!;
  const seniorPassword = process.env.TEST_SENIOR_PW!;

  afterEach(async () => {
    await ensureSignedOut(supabase);
  });

  it("allows a senior customer service user to approve a draft request", async () => {
    const seed = await seedDraftRequest(
      supabase,
      customerEmail,
      customerPassword,
    );

    await signIn(supabase, seniorEmail, seniorPassword);

    const { unmount } = render(<EventFlowPanel />, { wrapper });

    try {
      await waitFor(() => {
        expect(screen.queryByText(/Loading event requests/i)).toBeNull();
      });

      const requestHeading = await screen.findByText(
        `Request #${seed.eventId}`,
      );
      const row = requestHeading.closest("article") as HTMLElement | null;
      expect(row).not.toBeNull();

      const approveButton = within(row as HTMLElement).getByRole("button", {
        name: /approve/i,
      });

      fireEvent.click(approveButton);

      await waitFor(() => {
        const updatedRow = screen
          .getByText(`Request #${seed.eventId}`)
          .closest("article") as HTMLElement | null;
        expect(updatedRow).not.toBeNull();
        expect(
          within(updatedRow as HTMLElement).queryByRole("button", {
            name: /approve/i,
          }),
        ).toBeNull();
      });

      await waitFor(() => {
        const updatedRow = screen
          .getByText(`Request #${seed.eventId}`)
          .closest("article") as HTMLElement | null;
        expect(updatedRow).not.toBeNull();
        expect(
          within(updatedRow as HTMLElement).getByText("PENDING"),
        ).toBeInTheDocument();
      });

      const updatedRow = screen
        .getByText(`Request #${seed.eventId}`)
        .closest("article") as HTMLElement | null;
      expect(updatedRow).not.toBeNull();
      expect(
        within(updatedRow as HTMLElement).getByText(/Review progress/i),
      ).toBeInTheDocument();
    } finally {
      await cleanupTestData(supabase, seed.eventId, seed.clientId);
      unmount();
    }
  });

  it("allows a senior customer service user to reject a draft request", async () => {
    const seed = await seedDraftRequest(
      supabase,
      customerEmail,
      customerPassword,
    );

    await signIn(supabase, seniorEmail, seniorPassword);

    const { unmount } = render(<EventFlowPanel />, { wrapper });

    try {
      await waitFor(() => {
        expect(screen.queryByText(/Loading event requests/i)).toBeNull();
      });

      const requestHeading = await screen.findByText(
        `Request #${seed.eventId}`,
      );
      const row = requestHeading.closest("article") as HTMLElement | null;
      expect(row).not.toBeNull();

      const rejectButton = within(row as HTMLElement).getByRole("button", {
        name: /reject/i,
      });

      fireEvent.click(rejectButton);

      await waitFor(() => {
        const updatedRow = screen
          .getByText(`Request #${seed.eventId}`)
          .closest("article") as HTMLElement | null;
        expect(updatedRow).not.toBeNull();
        expect(
          within(updatedRow as HTMLElement).queryByRole("button", {
            name: /reject/i,
          }),
        ).toBeNull();
      });

      await waitFor(() => {
        const updatedRow = screen
          .getByText(`Request #${seed.eventId}`)
          .closest("article") as HTMLElement | null;
        expect(updatedRow).not.toBeNull();
        expect(
          within(updatedRow as HTMLElement).getByText("REJECTED"),
        ).toBeInTheDocument();
      });
    } finally {
      await cleanupTestData(supabase, seed.eventId, seed.clientId);
      unmount();
    }
  });
});
