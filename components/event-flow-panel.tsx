"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { hasEnvVars } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  EVENT_PREFERENCES,
  EVENT_TYPES,
  createEventRequest,
  listEventRequests,
  type EventPreference,
  type EventRequestRecord,
  type EventType,
} from "@/lib/event-request-service";

type AlertState =
  | { type: "error"; message: string }
  | { type: "success"; message: string }
  | null;

type FormState = {
  clientId: string;
  eventType: EventType;
  startTime: string;
  finishTime: string;
  location: string;
  preferences: EventPreference[];
  note: string;
};

type ClientOption = {
  id: number;
  name: string;
  email: string | null;
  phone_number: string | null;
};

const defaultFormState: FormState = {
  clientId: "",
  eventType: EVENT_TYPES[0],
  startTime: "",
  finishTime: "",
  location: "",
  preferences: [],
  note: "",
};

export function EventFlowPanel() {
  const { profile } = useAuth();
  const [eventRequests, setEventRequests] = useState<EventRequestRecord[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [alert, setAlert] = useState<AlertState>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [viewingRequest, setViewingRequest] =
    useState<EventRequestRecord | null>(null);
  const [formState, setFormState] = useState<FormState>(defaultFormState);

  const canCreate = profile?.role === "CUSTOMER_SERVICE";
  const supabase = useMemo(() => {
    if (!hasEnvVars) {
      return null;
    }
    return createClient();
  }, []);

  const fetchData = useCallback(async () => {
    if (!supabase) {
      setAlert({
        type: "error",
        message:
          "Supabase environment variables are missing. Contact an administrator.",
      });
      setEventRequests([]);
      setClients([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setAlert(null);
    try {
      const [requests, clientResponse] = await Promise.all([
        listEventRequests(),
        supabase
          .from("client")
          .select("id, name, email, phone_number")
          .order("name", { ascending: true }),
      ]);

      if (clientResponse.error) {
        throw clientResponse.error;
      }

      const clientData = (clientResponse.data ?? []) as ClientOption[];

      setEventRequests(requests);
      setClients(clientData);
      setFormState((prev) => ({
        ...prev,
        clientId:
          prev.clientId ||
          (clientData.length > 0 ? String(clientData[0].id) : ""),
      }));
    } catch (error) {
      console.error(error);
      setAlert({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to load event requests. Try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormState((prev) => ({
      ...defaultFormState,
      clientId:
        prev.clientId ||
        (clients.length > 0 ? String(clients[0].id) : ""),
    }));
  };

  const openCreateModal = () => {
    if (!canCreate) {
      return;
    }
    setAlert(null);
    if (!formState.clientId && clients.length > 0) {
      setFormState((prev) => ({
        ...prev,
        clientId: String(clients[0].id),
      }));
    }
    setIsCreateOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateOpen(false);
    resetForm();
    setIsSubmitting(false);
  };

  const handlePreferenceToggle = (preference: EventPreference) => {
    setFormState((prev) => {
      const exists = prev.preferences.includes(preference);
      if (exists) {
        return {
          ...prev,
          preferences: prev.preferences.filter((item) => item !== preference),
        };
      }
      return {
        ...prev,
        preferences: [...prev.preferences, preference],
      };
    });
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile || !canCreate) {
      setAlert({
        type: "error",
        message: "You do not have permission to create event requests.",
      });
      return;
    }

    if (!formState.clientId) {
      setAlert({
        type: "error",
        message: "Please select a client before submitting.",
      });
      return;
    }

    if (!formState.startTime || !formState.finishTime) {
      setAlert({
        type: "error",
        message: "Start time and finish time are required.",
      });
      return;
    }

    setIsSubmitting(true);
    setAlert(null);

    try {
      const payload = {
        clientId: Number(formState.clientId),
        eventType: formState.eventType,
        startTime: new Date(formState.startTime).toISOString(),
        finishTime: new Date(formState.finishTime).toISOString(),
        location: formState.location,
        note: formState.note,
        preferences: formState.preferences,
        submitterId: profile.id,
      };

      await createEventRequest(payload);
      setAlert({
        type: "success",
        message: "Event request created successfully.",
      });
      closeCreateModal();
      void fetchData();
    } catch (error) {
      console.error(error);
      setAlert({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to create the event request.",
      });
      setIsSubmitting(false);
    }
  };

  const statusBadge = (status: string) => {
    const classes =
      status === "DRAFT"
        ? "bg-amber-100 text-amber-700 border-amber-200"
        : "bg-emerald-100 text-emerald-700 border-emerald-200";
    return (
      <span className={`rounded-full border px-2 py-1 text-xs font-medium ${classes}`}>
        {status}
      </span>
    );
  };

  const sortedPreferences = useMemo(
    () => EVENT_PREFERENCES.slice().sort(),
    [],
  );

  const renderRequestRow = (request: EventRequestRecord) => (
    <article
      key={request.id}
      className="flex flex-col gap-3 px-6 py-5 md:flex-row md:items-center md:justify-between"
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-slate-800">
            Request #{request.id}
          </h3>
          {statusBadge(request.status)}
        </div>
        <div className="text-sm text-slate-500">
          <p>
            <span className="font-medium text-slate-700">Client:</span>{" "}
            {request.client?.name ?? "Unknown"}
          </p>
          <p>
            <span className="font-medium text-slate-700">Event type:</span>{" "}
            {request.event_type}
          </p>
          <p>
            <span className="font-medium text-slate-700">Submitted:</span>{" "}
            {new Date(request.created_at).toLocaleString()}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 self-start md:self-center">
        <button
          type="button"
          onClick={() => setViewingRequest(request)}
          className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
        >
          View
        </button>
      </div>
    </article>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800">
            Event Request Management
          </h2>
          <p className="text-sm text-slate-500">
            Review incoming event requests and prepare the pipeline for upcoming work.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          disabled={!canCreate}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          New Event Request
        </button>
      </header>

      {alert && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            alert.type === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {alert.message}
        </div>
      )}

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Total event requests</span>
            <span>{eventRequests.length}</span>
          </div>
        </div>
        <div className="divide-y divide-slate-200">
          {isLoading ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              Loading event requests...
            </div>
          ) : eventRequests.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              No event requests yet. Stay tuned for updates.
            </div>
          ) : (
            eventRequests.map(renderRequestRow)
          )}
        </div>
      </section>

      {viewingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-2xl space-y-4 rounded-lg bg-white p-6 shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                  Event request #{viewingRequest.id}
                </h3>
                <p className="text-sm text-slate-500">
                  Submitted on {new Date(viewingRequest.created_at).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingRequest(null)}
                className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <DetailItem label="Client">
                {viewingRequest.client?.name ?? "Unknown"}
              </DetailItem>
              <DetailItem label="Event type">{viewingRequest.event_type}</DetailItem>
              <DetailItem label="Status">{viewingRequest.status}</DetailItem>
              <DetailItem label="Submitter">
                {viewingRequest.submitter?.username ??
                  viewingRequest.submitter?.email ??
                  viewingRequest.submitter_id}
              </DetailItem>
              <DetailItem label="Start time">
                {new Date(viewingRequest.start_time).toLocaleString()}
              </DetailItem>
              <DetailItem label="Finish time">
                {new Date(viewingRequest.finish_time).toLocaleString()}
              </DetailItem>
            </div>
            <DetailItem label="Location">
              {viewingRequest.location || "Not specified"}
            </DetailItem>
            <DetailItem label="Preferences">
              {viewingRequest.preferences?.length
                ? viewingRequest.preferences.join(", ")
                : "No preferences selected"}
            </DetailItem>
            <DetailItem label="Notes">
              {viewingRequest.note || "No additional notes"}
            </DetailItem>
          </div>
        </div>
      )}

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                  New Event Request
                </h3>
                <p className="text-sm text-slate-500">
                  Provide the event details and assign it to an existing client.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
            <form className="mt-6 space-y-6" onSubmit={handleCreate}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="event-client"
                    className="text-sm font-medium text-slate-700"
                  >
                    Client
                  </label>
                  <select
                    id="event-client"
                    value={formState.clientId}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        clientId: event.target.value,
                      }))
                    }
                    required
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="" disabled>
                      Select a client
                    </option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="event-type"
                    className="text-sm font-medium text-slate-700"
                  >
                    Event type
                  </label>
                  <select
                    id="event-type"
                    value={formState.eventType}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        eventType: event.target.value as EventType,
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    {EVENT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="event-start"
                    className="text-sm font-medium text-slate-700"
                  >
                    Start time
                  </label>
                  <input
                    id="event-start"
                    type="datetime-local"
                    value={formState.startTime}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        startTime: event.target.value,
                      }))
                    }
                    required
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
                <div>
                  <label
                    htmlFor="event-finish"
                    className="text-sm font-medium text-slate-700"
                  >
                    Finish time
                  </label>
                  <input
                    id="event-finish"
                    type="datetime-local"
                    value={formState.finishTime}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        finishTime: event.target.value,
                      }))
                    }
                    required
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="event-location"
                  className="text-sm font-medium text-slate-700"
                >
                  Location
                </label>
                <input
                  id="event-location"
                  type="text"
                  value={formState.location}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      location: event.target.value,
                    }))
                  }
                  placeholder="Venue, address, or general location"
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Preferences</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {sortedPreferences.map((preference) => (
                    <label
                      key={preference}
                      className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={formState.preferences.includes(preference)}
                        onChange={() => handlePreferenceToggle(preference)}
                      />
                      <span>{preference}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label
                  htmlFor="event-note"
                  className="text-sm font-medium text-slate-700"
                >
                  Notes
                </label>
                <textarea
                  id="event-note"
                  value={formState.note}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      note: event.target.value,
                    }))
                  }
                  rows={4}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeCreateModal}
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

function DetailItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        {children}
      </div>
    </div>
  );
}
