"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";

type ClientRecord = {
  id: number;
  name: string;
  address: string | null;
  phone_number: string | null;
  email: string | null;
  discount_flag: boolean | null;
};

type FormState = {
  name: string;
  address: string;
  phoneNumber: string;
  email: string;
};

type Feedback =
  | { type: "success"; message: string }
  | { type: "error"; message: string }
  | null;

const CLIENT_TABLE = "client";

const defaultFormState: FormState = {
  name: "",
  address: "",
  phoneNumber: "",
  email: "",
};

export function ClientManagementPanel() {
  const supabase = useMemo(() => {
    if (!hasEnvVars) {
      return null;
    }
    return createClient();
  }, []);

  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState<FormState>(defaultFormState);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const fetchClients = useCallback(async () => {
    if (!supabase) {
      setFeedback({
        type: "error",
        message:
          "Supabase environment variables are missing. Contact an administrator.",
      });
      return;
    }

    setIsLoading(true);
    setFeedback(null);
    try {
      const { data, error } = await supabase
        .from(CLIENT_TABLE)
        .select("id, name, address, phone_number, email, discount_flag")
        .order("name", { ascending: true });

      if (error) {
        throw error;
      }

      setClients((data ?? []) as ClientRecord[]);
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to load client records.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void fetchClients();
  }, [fetchClients]);

  const resetForm = () => {
    setFormState(defaultFormState);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleCreateClient = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setFeedback({
        type: "error",
        message:
          "Supabase environment variables are missing. Contact an administrator.",
      });
      return;
    }

    const trimmedName = formState.name.trim();
    if (!trimmedName) {
      setFeedback({ type: "error", message: "Client name is required." });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const payload = {
        name: trimmedName,
        address: formState.address.trim() || null,
        phone_number: formState.phoneNumber.trim() || null,
        email: formState.email.trim() || null,
      };

      const { error } = await supabase.from(CLIENT_TABLE).insert(payload);

      if (error) {
        throw error;
      }

      setFeedback({
        type: "success",
        message: `${trimmedName} has been added.`,
      });
      closeModal();
      await fetchClients();
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to create the client record.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClient = async (clientId: number) => {
    if (!supabase) {
      setFeedback({
        type: "error",
        message:
          "Supabase environment variables are missing. Contact an administrator.",
      });
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this client? This cannot be undone.",
    );
    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const { error } = await supabase
        .from(CLIENT_TABLE)
        .delete()
        .eq("id", clientId);

      if (error) {
        throw error;
      }

      setFeedback({
        type: "success",
        message: "Client removed successfully.",
      });
      await fetchClients();
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to remove the client.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800">
            Client Management
          </h2>
          <p className="text-sm text-slate-500">
            Keep track of client records and onboard new clients.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFeedback(null);
            setIsModalOpen(true);
          }}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
        >
          New Client
        </button>
      </header>

      {feedback && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Total clients</span>
            <span>{clients.length}</span>
          </div>
        </div>
        <div className="divide-y divide-slate-200">
          {isLoading ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              Loading clients...
            </div>
          ) : clients.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              No clients found. Use the New Client button to add the first one.
            </div>
          ) : (
            clients.map((client) => (
              <article
                key={client.id}
                className="flex flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <h3 className="text-base font-semibold text-slate-800">
                    {client.name}
                  </h3>
                  <div className="mt-1 text-sm text-slate-500">
                    {client.address ? (
                      <p>{client.address}</p>
                    ) : (
                      <p className="italic text-slate-400">No address set</p>
                    )}
                    <p className="mt-1">
                      {client.phone_number || (
                        <span className="italic text-slate-400">
                          No phone number
                        </span>
                      )}
                    </p>
                    <p className="mt-1">
                      {client.email || (
                        <span className="italic text-slate-400">
                          No email provided
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteClient(client.id)}
                  className="self-start rounded-md border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                  disabled={isSubmitting}
                >
                  Delete
                </button>
              </article>
            ))
          )}
        </div>
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                  New Client
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Provide the basic details to add a new client.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
            <form className="mt-6 space-y-4" onSubmit={handleCreateClient}>
              <div>
                <label
                  htmlFor="client-name"
                  className="text-sm font-medium text-slate-700"
                >
                  Name
                </label>
                <input
                  id="client-name"
                  type="text"
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  required
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label
                  htmlFor="client-address"
                  className="text-sm font-medium text-slate-700"
                >
                  Address
                </label>
                <textarea
                  id="client-address"
                  value={formState.address}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      address: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  rows={2}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="client-phone"
                    className="text-sm font-medium text-slate-700"
                  >
                    Phone Number
                  </label>
                  <input
                    id="client-phone"
                    type="tel"
                    value={formState.phoneNumber}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        phoneNumber: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label
                    htmlFor="client-email"
                    className="text-sm font-medium text-slate-700"
                  >
                    Email
                  </label>
                  <input
                    id="client-email"
                    type="email"
                    value={formState.email}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        email: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? "Saving..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
