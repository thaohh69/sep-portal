export type ClientRecord = {
  id: number;
  name: string;
  address: string | null;
  phone_number: string | null;
  email: string | null;
  discount_flag: boolean | null;
};

export type ClientFormState = {
  name: string;
  address: string;
  phoneNumber: string;
  email: string;
};

export type ClientInsertPayload = {
  name: string;
  address: string | null;
  phone_number: string | null;
  email: string | null;
};

export function trimValue(value: string) {
  return value.trim();
}

export function normalizeClientForm(state: ClientFormState): ClientInsertPayload {
  const name = trimValue(state.name);
  const address = trimValue(state.address);
  const phoneNumber = trimValue(state.phoneNumber);
  const email = trimValue(state.email);

  return {
    name,
    address: address || null,
    phone_number: phoneNumber || null,
    email: email || null,
  };
}

export function validateClientForm(state: ClientFormState) {
  const name = trimValue(state.name);
  if (!name) {
    return { ok: false as const, message: "Client name is required." };
  }
  return { ok: true as const, message: null };
}
