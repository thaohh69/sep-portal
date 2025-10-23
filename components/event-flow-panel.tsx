"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import {
  EVENT_PREFERENCES,
  EVENT_TYPES,
  buildCreateEventRequestInput,
  type EventPreference,
  type EventRequestFormState,
  type EventRequestRecord,
  type EventType,
  validateEventRequestForm,
} from "@/lib/event-request";
import {
  EVENT_REQUEST_REVIEW_STEPS,
  EVENT_REQUEST_STATUS_STAGE,
  type EventRequestReviewStep,
  type EventRequestStatus,
} from "@/lib/event-request-config";
import {
  createEventRequestAction,
  listEventRequestsAction,
  reviewEventRequestAction,
  updateEventRequestStatusAction,
  type ReviewEventRequestDecision,
} from "@/app/actions/event-requests";
import { listClientsAction } from "@/app/actions/client-management";
import type { ClientRecord } from "@/lib/client-management";

type AlertState =
  | { type: "error"; message: string }
  | { type: "success"; message: string }
  | null;

type ClientOption = {
  id: number;
  name: string;
  email: string | null;
  phone_number: string | null;
};

const defaultFormState: EventRequestFormState = {
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
  const [formState, setFormState] =
    useState<EventRequestFormState>(defaultFormState);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [feedbackNotes, setFeedbackNotes] = useState<Record<number, string>>(
    {},
  );

  const role = profile?.role;
  const canCreate = role === "CUSTOMER_SERVICE";
  const isSeniorCustomerService = role === "SENIOR_CUSTOMER_SERVICE";
  const isFinancialManager = role === "FINANCIAL_MANAGER";
  const isAdministrationManager = role === "ADMINISTRATION_MANAGER";

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setAlert(null);
    try {
      const [requestsResult, clientsResult] = await Promise.all([
        listEventRequestsAction(),
        listClientsAction(),
      ]);

      if (!requestsResult.success) {
        throw new Error(
          requestsResult.error ||
            "Failed to load event requests. Try again later.",
        );
      }

      if (!clientsResult.success) {
        throw new Error(
          clientsResult.error ||
            "Failed to load client records. Try again later.",
        );
      }

      const clientData = clientsResult.data.map(
        (client: ClientRecord): ClientOption => ({
          id: client.id,
          name: client.name,
          email: client.email,
          phone_number: client.phone_number,
        }),
      );

      setEventRequests(requestsResult.data);
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

  const getFeedbackDraft = (requestId: number) =>
    feedbackNotes[requestId] ?? "";

  const clearFeedbackDraft = (requestId: number) => {
    setFeedbackNotes((prev) => {
      if (!(requestId in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[requestId];
      return next;
    });
  };

  const setFeedbackDraft = (requestId: number, value: string) => {
    setFeedbackNotes((prev) => ({
      ...prev,
      [requestId]: value,
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

  const handleDraftDecision = async (
    requestId: number,
    nextStatus: Extract<EventRequestStatus, "PENDING" | "REJECTED">,
  ) => {
    if (!isSeniorCustomerService || !profile) {
      setAlert({
        type: "error",
        message: "You do not have permission to review event requests.",
      });
      return;
    }

    setUpdatingId(requestId);
    setAlert(null);
    try {
      const feedback = getFeedbackDraft(requestId).trim();
      const response = await updateEventRequestStatusAction(
        requestId,
        nextStatus,
        { feedback },
      );
      if (!response.success) {
        throw new Error(
          response.error || "Failed to update event request status.",
        );
      }
      await fetchData();
      clearFeedbackDraft(requestId);
      setAlert({
        type: "success",
        message:
          nextStatus === "PENDING"
            ? "Event request sent to the financial review queue."
            : "Event request rejected.",
      });
    } catch (error) {
      console.error(error);
      setAlert({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to update event request status.",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const canHandleReviewStep = (step: EventRequestReviewStep) => {
    if (step === "FINANCIAL_MANAGER") {
      return isFinancialManager;
    }
    if (step === "ADMINISTRATION_MANAGER") {
      return isAdministrationManager;
    }
    if (step === "CUSTOMER_MEETING") {
      return isSeniorCustomerService;
    }
    return false;
  };

  const handleReviewDecision = async (
    requestId: number,
    step: EventRequestReviewStep,
    decision: ReviewEventRequestDecision,
  ) => {
    if (!profile || !canHandleReviewStep(step)) {
      setAlert({
        type: "error",
        message: "You do not have permission to review event requests.",
      });
      return;
    }

    setUpdatingId(requestId);
    setAlert(null);

    try {
      const feedback = getFeedbackDraft(requestId).trim();
      const response = await reviewEventRequestAction(requestId, step, decision, {
        feedback,
      });
      if (!response.success) {
        throw new Error(
          response.error || "Failed to update event request status.",
        );
      }

      await fetchData();
      clearFeedbackDraft(requestId);

      if (decision === "REJECT") {
        setAlert({
          type: "success",
          message: "Event request rejected.",
        });
        return;
      }

      const currentIndex = EVENT_REQUEST_REVIEW_STEPS.findIndex(
        (item) => item.key === step,
      );
      const nextStep = EVENT_REQUEST_REVIEW_STEPS[currentIndex + 1];

      setAlert({
        type: "success",
        message: nextStep
          ? `Event request advanced to ${nextStep.label}.`
          : "Event request marked as approved.",
      });
    } catch (error) {
      console.error(error);
      setAlert({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to update event request status.",
      });
    } finally {
      setUpdatingId(null);
    }
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

    const validation = validateEventRequestForm(formState);
    if (!validation.ok) {
      setAlert({ type: "error", message: validation.message });
      return;
    }

    setIsSubmitting(true);
    setAlert(null);

    try {

      const payload = buildCreateEventRequestInput(formState, profile.id);
      const response = await createEventRequestAction(payload);
      if (!response.success) {
        throw new Error(
          response.error || "Failed to create the event request.",
        );
      }
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

  const statusBadge = (status: EventRequestStatus) => {
    const classes: Record<EventRequestStatus, string> = {
      DRAFT: "bg-slate-100 text-slate-700 border-slate-300",
      PENDING: "bg-amber-100 text-amber-700 border-amber-200",
      REJECTED: "bg-rose-100 text-rose-700 border-rose-200",
      APPROVED: "bg-teal-100 text-teal-700 border-teal-200",
      OPEN: "bg-emerald-100 text-emerald-700 border-emerald-200",
    };
    return (
      <span
        className={`rounded-full border px-2 py-1 text-xs font-medium ${classes[status]}`}
      >
        {status}
      </span>
    );
  };

  const sortedPreferences = useMemo<EventPreference[]>(
    () => EVENT_PREFERENCES.slice().sort(),
    [],
  );

  const renderRequestRow = (request: EventRequestRecord) => {
    const currentStepLabel = request.review_step
      ? EVENT_REQUEST_REVIEW_STEPS.find(
          (step) => step.key === request.review_step,
        )?.label ?? request.review_step
      : null;

    const showProgress =
      request.status === "PENDING" ||
      request.status === "APPROVED" ||
      request.status === "OPEN";

    const canReviewDraft = isSeniorCustomerService && request.status === "DRAFT";
    const canReviewPending =
      request.status === "PENDING" &&
      request.review_step !== null &&
      canHandleReviewStep(request.review_step);

    const activeReviewStep = request.review_step;
    const feedbackDraft = getFeedbackDraft(request.id);

    return (
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
            {request.status === "PENDING" && currentStepLabel && (
              <p>
                <span className="font-medium text-slate-700">
                  Awaiting review:
                </span>{" "}
                {currentStepLabel}
              </p>
            )}
          </div>
        </div>
        {showProgress && (
          <div className="md:w-2/3">
            <ReviewProgress
              status={request.status}
              reviewStep={request.review_step}
            />
          </div>
        )}
        <div className="flex flex-col gap-2 self-start md:self-center md:w-1/3">
          {(canReviewDraft || canReviewPending) && (
            <textarea
              value={feedbackDraft}
              onChange={(event) =>
                setFeedbackDraft(request.id, event.target.value)
              }
              placeholder="Add feedback for this decision"
              rows={2}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setViewingRequest(request)}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              View
            </button>
            {canReviewDraft && (
              <>
                <button
                  type="button"
                  onClick={() => handleDraftDecision(request.id, "PENDING")}
                  className="rounded-md border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-600 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={updatingId === request.id}
                >
                  {updatingId === request.id
                    ? "Submitting..."
                    : "Submit for review"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDraftDecision(request.id, "REJECTED")}
                  className="rounded-md border border-rose-500 px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={updatingId === request.id}
                >
                  {updatingId === request.id ? "Processing..." : "Reject"}
                </button>
              </>
            )}
            {canReviewPending && activeReviewStep && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    handleReviewDecision(request.id, activeReviewStep, "APPROVE")
                  }
                  className="rounded-md border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-600 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={updatingId === request.id}
                >
                  {updatingId === request.id ? "Approving..." : "Approve"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleReviewDecision(request.id, activeReviewStep, "REJECT")
                  }
                  className="rounded-md border border-rose-500 px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={updatingId === request.id}
                >
                  {updatingId === request.id ? "Processing..." : "Reject"}
                </button>
              </>
            )}
          </div>
        </div>
      </article>
    );
  };

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
            <DetailItem label="SCSO feedback">
              {viewingRequest.scso_feedback || "No feedback"}
            </DetailItem>
            <DetailItem label="Financial Manager feedback">
              {viewingRequest.financial_manager_feedback || "No feedback"}
            </DetailItem>
            <DetailItem label="Administration Manager feedback">
              {viewingRequest.administration_manager_feedback || "No feedback"}
            </DetailItem>
            <DetailItem label="Customer Meeting feedback">
              {viewingRequest.customer_meeting_feedback || "No feedback"}
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

function ReviewProgress({
  status,
  reviewStep,
}: {
  status: EventRequestStatus;
  reviewStep: EventRequestReviewStep | null;
}) {
  const steps = EVENT_REQUEST_REVIEW_STEPS;

  let stage: number | null;
  if (status === "PENDING") {
    if (reviewStep) {
      const index = steps.findIndex((step) => step.key === reviewStep);
      stage = index >= 0 ? index : 0;
    } else {
      stage = 0;
    }
  } else {
    stage = EVENT_REQUEST_STATUS_STAGE[status];
  }

  if (stage === null) {
    return null;
  }

  const resolvedStage =
    typeof stage === "number" ? Math.min(stage, steps.length) : null;

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Review progress
      </p>
      <ol className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        {steps.map((step, index) => {
          const isComplete =
            resolvedStage === null
              ? false
              : resolvedStage === steps.length || index < resolvedStage;
          const isCurrent =
            resolvedStage === null
              ? false
              : resolvedStage < steps.length && resolvedStage === index;
          const bubbleClass = isComplete
            ? "bg-emerald-500 text-white border-emerald-500"
            : isCurrent
              ? "bg-blue-100 text-blue-600 border-blue-200"
              : "bg-white text-slate-400 border-slate-200";
          const labelClass = isComplete
            ? "text-emerald-600"
            : isCurrent
              ? "text-blue-600"
              : "text-slate-400";
          return (
            <li key={step.key} className="flex items-center gap-3 text-sm">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${bubbleClass}`}
              >
                {index + 1}
              </span>
              <span className={`font-medium ${labelClass}`}>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
