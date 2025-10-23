"use client";

export const EVENT_REQUEST_STATUSES = [
  "DRAFT",
  "PENDING",
  "REJECTED",
  "OPEN",
] as const;

export type EventRequestStatus = (typeof EVENT_REQUEST_STATUSES)[number];

export const EVENT_REQUEST_REVIEW_STEPS = [
  { key: "FINANCIAL_MANAGER", label: "Financial Manager" },
  { key: "ADMINISTRATION_MANAGER", label: "Administration Manager" },
  { key: "CUSTOMER_MEETING", label: "Customer Meeting" },
  { key: "RESOURCE_CONFIRMING", label: "Resource Confirming" },
] as const;

export type EventRequestReviewStep =
  (typeof EVENT_REQUEST_REVIEW_STEPS)[number]["key"];

export const EVENT_REQUEST_STATUS_STAGE: Record<EventRequestStatus, number | null> =
  {
    DRAFT: null,
    REJECTED: null,
    PENDING: 0,
    OPEN: null,
  };
