'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import type {
  ClientInsertPayload,
  ClientRecord,
} from '@/lib/client-management';

const CLIENT_TABLE = 'client';

export async function listClientsAction() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(CLIENT_TABLE)
    .select('id, name, address, phone_number, email, discount_flag')
    .order('name', { ascending: true });

  if (error) {
    console.error('[listClientsAction] Failed to fetch clients', error);
    return { success: false as const, error: error.message, data: [] as ClientRecord[] };
  }

  return {
    success: true as const,
    data: (data ?? []) as ClientRecord[],
  };
}

export async function createClientAction(payload: ClientInsertPayload) {
  const supabase = createAdminClient();

  if (!payload.name.trim()) {
    return {
      success: false as const,
      error: 'Client name is required.',
    };
  }

  const { data, error } = await supabase
    .from(CLIENT_TABLE)
    .insert(payload)
    .select('id')
    .single();

  if (error) {
    console.error('[createClientAction] Failed to insert client', error);
    return { success: false as const, error: error.message };
  }

  if (!data?.id) {
    return {
      success: false as const,
      error: 'Client record was created but no identifier was returned.',
    };
  }

  return { success: true as const, clientId: data.id as number };
}

export async function deleteClientAction(clientId: number) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from(CLIENT_TABLE)
    .delete()
    .eq('id', clientId);

  if (error) {
    console.error('[deleteClientAction] Failed to delete client', error);
    return { success: false as const, error: error.message };
  }

  return { success: true as const };
}
