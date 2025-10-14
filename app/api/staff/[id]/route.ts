"use server";

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  type DepartmentKey,
  type MenuKey,
  type RoleKey,
} from "@/lib/app-config";

type UpdateStaffPayload = {
  email: string;
  username: string;
  phone?: string | null;
  department: DepartmentKey;
  role: RoleKey;
  permissions: MenuKey[];
  password?: string;
};

const STAFF_TABLE = "staff_profiles";

function ensurePermissions(raw: MenuKey[] | undefined | null): MenuKey[] {
  const normalized = Array.isArray(raw) ? raw.filter(Boolean) : [];
  const unique = new Set<MenuKey>(["home"]);
  normalized.forEach((permission) => {
    unique.add(permission as MenuKey);
  });
  return Array.from(unique);
}

async function requireHrUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from(STAFF_TABLE)
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Failed to load requester profile", profileError);
    return {
      response: NextResponse.json(
        { error: "Unable to verify permissions." },
        { status: 500 },
      ),
    };
  }

  if (!profile || profile.role !== "HR") {
    return {
      response: NextResponse.json(
        { error: "Only HR users can manage staff accounts." },
        { status: 403 },
      ),
    };
  }

  try {
    const admin = createAdminClient();
    return { admin };
  } catch (error) {
    console.error(error);
    return {
      response: NextResponse.json(
        {
          error:
            "Supabase service role key is not configured. Ask an administrator to set SUPABASE_SERVICE_ROLE_KEY.",
        },
        { status: 500 },
      ),
    };
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await requireHrUser();
  if ("response" in context) {
    return context.response;
  }

  const { admin } = context;
  const { id: userId } = await params;

  let payload: UpdateStaffPayload;
  try {
    payload = (await request.json()) as UpdateStaffPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  if (
    !payload.email ||
    !payload.username ||
    !payload.department ||
    !payload.role
  ) {
    return NextResponse.json(
      { error: "Email, username, department, and role are required." },
      { status: 400 },
    );
  }

  const permissions = ensurePermissions(payload.permissions);

  const updateInput: {
    email?: string;
    password?: string;
    user_metadata: Record<string, unknown>;
  } = {
    user_metadata: {
      username: payload.username,
      phone: payload.phone ?? null,
      department: payload.department,
      role: payload.role,
    },
  };

  if (payload.email) {
    updateInput.email = payload.email;
  }

  if (payload.password) {
    updateInput.password = payload.password;
  }

  const { error: updateAuthError } = await admin.auth.admin.updateUserById(
    userId,
    updateInput,
  );

  if (updateAuthError) {
    console.error("Failed to update auth user", updateAuthError);
    return NextResponse.json(
      { error: updateAuthError.message },
      { status: 400 },
    );
  }

  const { data, error: profileError } = await admin
    .from(STAFF_TABLE)
    .update({
      email: payload.email,
      username: payload.username,
      phone: payload.phone ?? null,
      department: payload.department,
      role: payload.role,
      permissions,
    })
    .eq("id", userId)
    .select("id, email, username, phone, department, role, permissions")
    .single();

  if (profileError || !data) {
    console.error("Failed to update staff profile", profileError);
    return NextResponse.json(
      { error: profileError?.message ?? "Unable to update staff profile." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    staff: {
      id: data.id,
      email: data.email,
      username: data.username,
      phone: data.phone,
      department: data.department,
      role: data.role,
      permissions,
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await requireHrUser();
  if ("response" in context) {
    return context.response;
  }

  const { admin } = context;
  const { id: userId } = await params;

  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    console.error("Failed to delete auth user", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await admin.from(STAFF_TABLE).delete().eq("id", userId);

  return NextResponse.json({ success: true });
}
