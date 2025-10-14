"use server";

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  type DepartmentKey,
  type MenuKey,
  type RoleKey,
} from "@/lib/app-config";

type StaffRow = {
  id: string;
  email: string;
  username: string;
  phone: string | null;
  department: DepartmentKey;
  role: RoleKey;
  permissions: MenuKey[];
};

type CreateStaffPayload = {
  email: string;
  password: string;
  username: string;
  phone?: string;
  department: DepartmentKey;
  role: RoleKey;
  permissions: MenuKey[];
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

function mapStaffRow(row: StaffRow): StaffRow {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    phone: row.phone,
    department: row.department,
    role: row.role,
    permissions: ensurePermissions(row.permissions as MenuKey[]),
  };
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

export async function GET() {
  const context = await requireHrUser();
  if ("response" in context) {
    return context.response;
  }

  const { admin } = context;

  const { data, error } = await admin
    .from(STAFF_TABLE)
    .select("id, email, username, phone, department, role, permissions")
    .order("username", { ascending: true });

  if (error) {
    console.error("Failed to fetch staff directory", error);
    return NextResponse.json(
      { error: "Unable to load staff list." },
      { status: 500 },
    );
  }

  const staff = (data ?? []).map(mapStaffRow);

  return NextResponse.json({ staff });
}

export async function POST(request: NextRequest) {
  const context = await requireHrUser();
  if ("response" in context) {
    return context.response;
  }

  const { admin } = context;

  let payload: CreateStaffPayload;
  try {
    payload = (await request.json()) as CreateStaffPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  if (
    !payload.email ||
    !payload.password ||
    !payload.username ||
    !payload.department ||
    !payload.role
  ) {
    return NextResponse.json(
      { error: "Email, username, password, department, and role are required." },
      { status: 400 },
    );
  }

  const permissions = ensurePermissions(payload.permissions);

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        username: payload.username,
        phone: payload.phone ?? null,
        department: payload.department,
        role: payload.role,
      },
    });

  if (createError) {
    console.error("Failed to create auth user", createError);
    return NextResponse.json(
      { error: createError.message },
      { status: 400 },
    );
  }

  const userId = created.user?.id;

  if (!userId) {
    return NextResponse.json(
      {
        error:
          "User created but Supabase did not return an identifier. Try again.",
      },
      { status: 500 },
    );
  }

  const { data: profile, error: profileError } = await admin
    .from(STAFF_TABLE)
    .insert({
      id: userId,
      email: payload.email,
      username: payload.username,
      phone: payload.phone ?? null,
      department: payload.department,
      role: payload.role,
      permissions,
    })
    .select("id, email, username, phone, department, role, permissions")
    .single();

  if (profileError || !profile) {
    console.error("Failed to insert staff profile", profileError);
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json(
      { error: profileError?.message ?? "Unable to store staff profile." },
      { status: 400 },
    );
  }

  return NextResponse.json({ staff: mapStaffRow(profile) }, { status: 201 });
}
