import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

type OrderLine = {
  menuId: string;
  studentId: string;
  optionId: string;
  date: string;
};

export async function POST(req: NextRequest) {
  const { email, schoolId, orders } = (await req.json()) as {
    email: string;
    schoolId: string;
    orders: OrderLine[];
  };

  if (!email || !schoolId || !orders?.length) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const admin = getAdmin();

  // Find or create guardian
  let { data: guardian } = await admin
    .from("guardians")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (!guardian) {
    const { data: newG, error } = await admin
      .from("guardians")
      .insert({ email })
      .select("id")
      .single();
    if (error || !newG) {
      return NextResponse.json({ error: "Failed to register guardian" }, { status: 500 });
    }
    guardian = newG;
  }

  // Validate menus and look up option names
  const menuIds = [...new Set(orders.map((o) => o.menuId))];
  const { data: menus } = await (admin.from("meal_menus") as any)
    .select("id, date, options, school_id")
    .in("id", menuIds) as { data: Array<{ id: string; date: string; options: Array<{ id: string; name: string }>; school_id: string }> | null };

  if (!menus?.length) {
    return NextResponse.json({ error: "Menus not found" }, { status: 400 });
  }

  for (const m of menus) {
    if (m.school_id !== schoolId) {
      return NextResponse.json({ error: "Invalid menu" }, { status: 403 });
    }
    // Reject if past cutoff for today - handled client side, double-check server side
  }

  const menuMap = new Map(menus.map((m) => [m.id, m]));

  // Fetch students to validate they belong to school
  const studentIds = [...new Set(orders.map((o) => o.studentId))];
  const { data: students } = await admin
    .from("students")
    .select("id, first_name, year_group")
    .in("id", studentIds)
    .eq("school_id", schoolId) as { data: Array<{ id: string; first_name: string; year_group: string }> | null };

  const studentMap = new Map((students ?? []).map((s) => [s.id, s]));
  const validStudentIds = new Set(studentMap.keys());

  // Build insert rows
  const rows = orders
    .filter((o) => validStudentIds.has(o.studentId))
    .map((o) => {
      const menu = menuMap.get(o.menuId)!;
      const option = menu.options.find((op) => op.id === o.optionId);
      return {
        school_id: schoolId,
        menu_id: o.menuId,
        student_id: o.studentId,
        guardian_id: guardian!.id,
        option_id: o.optionId,
        option_name: option?.name ?? o.optionId,
        date: menu.date,
      };
    });

  if (!rows.length) {
    return NextResponse.json({ error: "No valid orders" }, { status: 400 });
  }

  // Upsert (student+date is unique — replace existing order if re-submitted)
  const { error: insertError } = await (admin.from("meal_orders") as any).upsert(rows, {
    onConflict: "student_id,date",
    ignoreDuplicates: false,
  });

  if (insertError) {
    console.error("meal order insert error", insertError);
    return NextResponse.json({ error: "Failed to save orders" }, { status: 500 });
  }

  // Send confirmation email
  const orderSummary = rows
    .map((r) => {
      const student = studentMap.get(r.student_id);
      const date = new Date(r.date + "T12:00:00").toLocaleDateString("en-GB", {
        weekday: "long", day: "numeric", month: "long",
      });
      return `<tr><td style="padding:6px 12px;">${student?.first_name ?? ""} (Yr ${student?.year_group ?? ""})</td><td style="padding:6px 12px;">${date}</td><td style="padding:6px 12px;">${r.option_name}</td></tr>`;
    })
    .join("");

  await resend.emails.send({
    from: "School2Pay <noreply@school2pay.com>",
    to: email,
    subject: "Meal order confirmed",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111;">
        <h2 style="color:#2563eb;">Meal order confirmed ✓</h2>
        <p>Your meal orders have been placed successfully.</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:6px 12px;text-align:left;font-size:12px;">Child</th>
              <th style="padding:6px 12px;text-align:left;font-size:12px;">Day</th>
              <th style="padding:6px 12px;text-align:left;font-size:12px;">Choice</th>
            </tr>
          </thead>
          <tbody>${orderSummary}</tbody>
        </table>
        <p style="margin-top:24px;font-size:12px;color:#6b7280;">
          Orders can be changed by resubmitting before the 9:30am cutoff on each day.<br>
          Questions? Contact your school office.
        </p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
