/**
 * Integration tests: drive the ClientManagementPanel UI to verify Supabase writes.
 * Requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
 */

import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import { ClientManagementPanel } from "@/components/client-management-panel";
import { hasEnvVars } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

if (!hasEnvVars) {
  throw new Error(
    "Supabase environment variables are required for client management tests.",
  );
}

jest.setTimeout(30000);

function buildClientPayload() {
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    name: `UI Test Client ${uniqueSuffix}`,
    address: "123 Test Street",
    phoneNumber: "+46123456789",
    email: `ui-test-client-${uniqueSuffix}@example.com`,
  };
}

async function signInIfNeeded() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    const email = process.env.TEST_USER;
    const password = process.env.TEST_PW;

    if (!email || !password) {
      throw new Error("Client management UI tests require TEST_USER and TEST_PW credentials.");
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
  }
}

describe("ClientManagementPanel UI integration", () => {
  beforeAll(async () => {
    await signInIfNeeded();
  });

  it("creates a client through the UI", async () => {
    const supabase = createClient();
    const payload = buildClientPayload();

    await supabase.from("client").delete().eq("name", payload.name);

    const { unmount } = render(<ClientManagementPanel />);
    let createdId: number | null = null;

    try {
      await waitFor(() => {
        expect(screen.queryByText(/Loading clients/i)).toBeNull();
      });

      fireEvent.click(screen.getByRole("button", { name: /new client/i }));

      fireEvent.change(screen.getByLabelText(/name/i), {
        target: { value: payload.name },
      });
      fireEvent.change(screen.getByLabelText(/address/i), {
        target: { value: payload.address },
      });
      fireEvent.change(screen.getByLabelText(/phone number/i), {
        target: { value: payload.phoneNumber },
      });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: payload.email },
      });

      fireEvent.click(screen.getByRole("button", { name: /create/i }));

      await waitFor(() =>
        expect(screen.getByText(payload.name)).toBeInTheDocument(),
      );

      const { data: createdRow, error: fetchError } = await supabase
        .from("client")
        .select("id, email")
        .eq("name", payload.name)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      expect(createdRow).toBeTruthy();
      expect(createdRow?.email).toBe(payload.email);

      createdId = createdRow?.id ?? null;
      if (createdId == null) {
        throw new Error("Expected created client to include an id.");
      }
    } finally {
      if (createdId != null) {
        await supabase.from("client").delete().eq("id", createdId);
      }
      unmount();
    }
  });

  it("deletes a client through the UI", async () => {
    const supabase = createClient();
    const payload = buildClientPayload();

    const { data: upserted, error: upsertError } = await supabase
      .from("client")
      .upsert({
        name: payload.name,
        address: payload.address,
        phone_number: payload.phoneNumber,
        email: payload.email,
      })
      .select("id")
      .maybeSingle();

    if (upsertError) {
      throw upsertError;
    }

    const createdId = upserted?.id;
    if (!createdId) {
      throw new Error("Failed to seed client for delete test.");
    }

    const { unmount } = render(<ClientManagementPanel />);

    try {
      await waitFor(() => {
        expect(screen.queryByText(/Loading clients/i)).toBeNull();
      });

      await waitFor(() =>
        expect(screen.getByText(payload.name)).toBeInTheDocument(),
      );

      const row = screen.getByText(payload.name).closest("article");
      expect(row).not.toBeNull();
      const deleteButton = within(row as HTMLElement).getByRole("button", {
        name: /delete/i,
      });

      const confirmSpy = jest.spyOn(window, "confirm").mockReturnValue(true);
      try {
        fireEvent.click(deleteButton);
        await waitFor(() =>
          expect(screen.queryByText(payload.name)).not.toBeInTheDocument(),
        );
      } finally {
        confirmSpy.mockRestore();
      }

      await waitFor(async () => {
        const { data, error } = await supabase
          .from("client")
          .select("id")
          .eq("id", createdId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        expect(data).toBeNull();
      });
    } finally {
      await supabase.from("client").delete().eq("id", createdId);
      unmount();
    }
  });
});
