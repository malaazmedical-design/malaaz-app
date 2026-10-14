/* لوحة ملاذ — صفحات ReVoice (الاستشارات الأونلاين، أسئلة المرضى، مصدر التثبيت، الأسماء بالإنجليزي).
 * بيتحمّل من admin.html بعد السكريبت الرئيسي، ويستخدم نفس اتصال Supabase (sb) وتسجيل دخول الأدمن.
 * كل الكود داخل نطاق مغلق (RV) ومفيش أي متغير عام غير RV، عشان ما يتعارضش مع كود اللوحة القديم.
 * كل بيانات المستخدمين بتتكتب في الصفحة بـ textContent (مش innerHTML) عشان مفيش حقن HTML.
 * مصدر الأصل: admin-test/index.html (اتجرّب على مشروع التست).
 */
(function () {
  "use strict";

  const css = `
  .rv-mu{color:var(--muted);font-size:13px}
  .rv-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .rv-sp{flex:1}
  .rv-chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
  .rv-chip{border:1.5px solid var(--border);background:var(--white);color:var(--text);padding:7px 14px;border-radius:12px;cursor:pointer;font-weight:700;font-family:inherit;font-size:13px}
  .rv-chip.on{border-color:var(--accent);color:#8a6a14;background:rgba(201,168,76,.12)}
  .rv-card{background:var(--white);border:.5px solid var(--border);border-radius:16px;padding:16px;margin-bottom:12px}
  .rv-msg{white-space:pre-wrap;line-height:1.8;margin:8px 0}
  .rv-badge{display:inline-flex;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;background:var(--bg)}
  .rv-btn{border:0;border-radius:10px;padding:8px 16px;font-weight:700;cursor:pointer;background:var(--accent);color:var(--dark);font-family:inherit;font-size:13px}
  .rv-btn.ghost{background:transparent;border:1.5px solid var(--border);color:var(--text)}
  .rv-btn.bad{background:transparent;border:1.5px solid var(--danger);color:var(--danger)}
  .rv-btn.ok{background:var(--success);color:#fff}
  .rv-in{background:#fff;color:var(--text);border:1.5px solid rgba(58,74,78,.15);border-radius:10px;padding:8px 12px;font-family:inherit;font-size:13px}
  .rv-thumbs{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
  .rv-thumbs img{width:72px;height:72px;object-fit:cover;border-radius:12px;cursor:pointer}
  .rv-empty{text-align:center;color:var(--muted);padding:40px 0}
  .rv-sub{background:var(--bg);border-radius:12px;padding:10px;margin-top:8px}
  .rv-table{width:100%;border-collapse:collapse;font-size:14px}
  .rv-table th{text-align:right;padding:6px 8px;color:var(--muted);font-weight:700;white-space:nowrap}
  .rv-table td{padding:8px;border-top:1px solid var(--border)}
  .rv-bad{color:var(--danger)} .rv-ok{color:var(--success)}
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);

  // DOM helper — النصوص بتتحط textContent
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "style") el.style.cssText = v;
      else el[k] = v;
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  }
  const fmt = (d) => new Date(d).toLocaleString("ar-EG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const badge = (text, color) => h("span", { class: "rv-badge", style: color ? `background:${color}22;color:${color}` : "" }, text);
  const GOLD = "#8a6a14", OK = "#2e7d32", BAD = "#c62828", BLUE = "#1565c0", AMBER = "#b7791f";

  const state = { current: "consults", askFilter: "open", conFilter: "pay", srcDays: 30, nameFilter: "all", nameQuery: "" };
  const roots = {};
  function rootOf(name) { return roots[name] || (roots[name] = document.getElementById("rv-body-" + name)); }
  function refresh() { load(state.current); }
  async function ensureAdmin() {
    // الأدمن اتأكد منه في تسجيل الدخول؛ ده تأكيد إضافي من قاعدة البيانات
    const { data } = await sb.rpc("is_admin");
    return !!data;
  }

  async function load(name) {
    state.current = name;
    const root = rootOf(name);
    if (!root) return;
    root.replaceChildren(h("div", { class: "rv-empty" }, "جاري التحميل…"));
    try {
      if (!(await ensureAdmin())) return root.replaceChildren(h("div", { class: "rv-empty rv-bad" }, "هذا الحساب ليس أدمن (جدول admin_users)."));
      const body = h("div");
      root.replaceChildren(body);
      await { consults: renderConsults, asks: renderAsks, sources: renderSources, names: renderNames, late: renderLate }[name](body);
    } catch (e) {
      root.replaceChildren(h("div", { class: "rv-empty rv-bad" }, "حدث خطأ: " + (e?.message || e)));
    }
  }

  // ───────── أسئلة المرضى ─────────
  async function renderAsks(root) {
    const filters = [["open", "تنتظر التوجيه"], ["routed", "موجّهة"], ["answered", "تم الرد"], ["all", "الكل"]];
    root.append(h("div", { class: "rv-chips" }, filters.map(([k, n]) => h("button", { class: "rv-chip" + (state.askFilter === k ? " on" : ""), onclick: () => { state.askFilter = k; refresh(); } }, n))));
    const list = h("div");
    root.append(list);

    let q = sb.from("ask_doctor_cases").select("*").order("created_at", { ascending: false }).limit(100);
    if (state.askFilter === "open") q = q.eq("status", "new");
    else if (state.askFilter === "routed") q = q.eq("status", "routed");
    else if (state.askFilter === "answered") q = q.eq("status", "answered");
    const [{ data: cases, error }, { data: specs }] = await Promise.all([q, sb.rpc("ask_specialty_counts")]);
    if (error) return list.replaceChildren(h("div", { class: "rv-empty" }, "خطأ: " + error.message));
    if (!cases.length) return list.replaceChildren(h("div", { class: "rv-empty" }, "لا توجد أسئلة"));

    const docIds = [...new Set(cases.map((c) => c.assigned_doctor_id).filter(Boolean))];
    const docs = {};
    if (docIds.length) (await sb.from("providers").select("id,name,specialty").in("id", docIds)).data?.forEach((d) => (docs[d.id] = d));

    list.replaceChildren(...cases.map((c) => {
      const stLabel = { new: "جديد", routed: "موجّه", answered: "تم الرد", cancelled: "ملغي", expired: "انتهت المهلة" }[c.status] || c.status;
      const stColor = { new: GOLD, routed: BLUE, answered: OK, cancelled: BAD, expired: BAD }[c.status] || "#6b7c80";
      const thumbs = h("div", { class: "rv-thumbs" });
      sb.from("ask_doctor_attachments").select("storage_path").eq("case_id", c.id).then(async ({ data }) => {
        for (const a of data || []) {
          const { data: s } = await sb.storage.from("ask-doctor-attachments").createSignedUrl(a.storage_path, 3600);
          if (s?.signedUrl) thumbs.append(h("img", { src: s.signedUrl, onclick: () => window.open(s.signedUrl, "_blank", "noopener") }));
        }
      });
      const card = h("div", { class: "rv-card" },
        h("div", { class: "rv-row" },
          h("b", {}, c.case_number || "—"),
          c.urgency_flag ? badge("⚠ أعراض عاجلة محتملة", BAD) : null,
          h("span", { class: "rv-sp" }), badge(stLabel, stColor), h("span", { class: "rv-mu" }, fmt(c.created_at))),
        h("div", { class: "rv-mu" }, [c.patient_name, c.suggested_specialty ? "اقتراح النظام: " + c.suggested_specialty : null].filter(Boolean).join(" · ")),
        h("div", { class: "rv-msg" }, c.message),
        thumbs);

      if (c.status === "new" || c.status === "routed") {
        const sel = h("select", { class: "rv-in" }, h("option", { value: "" }, "اختر التخصص…"),
          (specs || []).map((s) => h("option", { value: s.specialty }, `${s.specialty} — ${s.doctors} أطباء · ${s.available} متاح`)));
        sel.value = c.routed_specialty || ((specs || []).some((s) => s.specialty === c.suggested_specialty) ? c.suggested_specialty : "");
        card.append(h("div", { class: "rv-row" }, sel,
          h("button", { class: "rv-btn", onclick: async () => {
            if (!sel.value) return alert("اختر التخصص أولاً");
            const { data, error: e } = await sb.rpc("route_ask_case", { p_case: c.id, p_specialty: sel.value });
            if (e || data !== "ok") return alert("تعذّر التوجيه: " + (e?.message || data));
            refresh();
          } }, c.status === "routed" ? "إعادة توجيه" : "وجّه"),
          h("button", { class: "rv-btn bad", onclick: async () => {
            if (!confirm("إلغاء هذا السؤال؟")) return;
            const { error: e } = await sb.from("ask_doctor_cases").update({ status: "cancelled" }).eq("id", c.id);
            if (e) alert("تعذّر: " + e.message);
            refresh();
          } }, "إلغاء")));
        if (!(specs || []).length) card.append(h("div", { class: "rv-mu" }, "لا يوجد أطباء مفعّلون يقدمون استشارة أونلاين حالياً."));
      }
      if (c.status === "answered") {
        const d = docs[c.assigned_doctor_id];
        card.append(h("div", { class: "rv-sub" },
          h("div", { class: "rv-mu" }, `رد ${d ? d.name + " · " + (d.specialty || "") : ""} — ${c.answered_at ? fmt(c.answered_at) : ""}`),
          h("div", { class: "rv-msg" }, c.answer || "")));
      }
      return card;
    }));
  }

  // ───────── مصادر التثبيت ─────────
  async function renderSources(root) {
    root.append(h("div", { class: "rv-chips" }, [[7, "7 أيام"], [30, "30 يوم"], [90, "90 يوم"], [3650, "الكل"]].map(([d, n]) =>
      h("button", { class: "rv-chip" + (state.srcDays === d ? " on" : ""), onclick: () => { state.srcDays = d; refresh(); } }, n))));
    root.append(h("div", { class: "rv-mu", style: "margin-bottom:10px" }, "المستخدم بيتحسب أول مرة يسجّل دخول بعد التثبيت. الأرقام على أندرويد بس (بلاي ستور). المصدر بيتحدد من علامات رابط التحميل: utm_source و utm_medium و utm_campaign."));
    const list = h("div");
    root.append(list);
    const { data, error } = await sb.rpc("admin_install_stats", { p_days: state.srcDays });
    if (error) return list.replaceChildren(h("div", { class: "rv-empty" }, "خطأ: " + error.message));
    if (!data.length) return list.replaceChildren(h("div", { class: "rv-empty" }, "لا توجد بيانات بعد"));
    const total = data.reduce((a, r) => a + Number(r.users), 0);
    const pct = (a, b) => (b ? Math.round((Number(a) / Number(b)) * 100) + "%" : "—");
    list.replaceChildren(h("div", { class: "rv-card", style: "overflow-x:auto" },
      h("table", { class: "rv-table" },
        h("tr", {}, ["المصدر", "الوسيط", "الحملة", "المستخدمون", "عملوا حجز", "دفعوا استشارة"].map((t) => h("th", {}, t))),
        data.map((r) => h("tr", {},
          h("td", { style: "font-weight:800" }, r.source), h("td", {}, r.medium || "—"), h("td", {}, r.campaign || "—"),
          h("td", {}, r.users + " (" + pct(r.users, total) + ")"),
          h("td", {}, r.with_booking + " (" + pct(r.with_booking, r.users) + ")"),
          h("td", {}, r.with_paid_consult + " (" + pct(r.with_paid_consult, r.users) + ")"))))));
  }

  // ───────── الاستشارات الأونلاين ─────────
  const PERIODS = { morning: "صباحًا (8-12)", noon: "ظهرًا (12-4)", evening: "مساءً (4-9)", asap: "أسرع وقت ممكن" };
  const ALERTS = {
    doctor_declined: "🔴 الدكتور اعتذر · اختر بديلًا", doctor_expired: "🔴 الدكتور لم يرد · اختر بديلًا", doctor_silent: "⚠ الدكتور لم يرد منذ 30 دقيقة",
    deadline: "⏰ انتهت مهلة الدفع", no_proposal: "⚠ الطبيب لم يحدد موعدًا", client_silent: "⚠ العميل لم يرد على الموعد",
    client_rejected: "⚠ العميل رفض الموعد", doctor_late: "🔴 الطبيب متأخر عن الموعد", rating: "★ تقييم بانتظار الاعتماد", no_show: "العميل لم يحضر",
  };
  const CANCEL_REASONS = ["العميل لم يحوّل", "انتهت مهلة الدفع", "الطبيب لم يحضر", "العميل لم يرد على الموعد", "بناءً على طلب العميل", "الطبيب غير متاح", "سبب آخر"];

  async function rtcGauge() {
    const { data } = await sb.rpc("admin_rtc_usage");
    const u = data && data[0];
    if (!u) return null;
    const pct = Number(u.pct), limit = Number(u.monthly_limit);
    const color = pct >= u.stop_pct ? BAD : pct >= u.alert_pct ? AMBER : OK;
    const lim = h("input", { class: "rv-in", type: "number", value: limit, style: "width:100px", dir: "ltr" });
    const save = async (k, v) => {
      const { data: r } = await sb.rpc("admin_set_setting", { p_key: k, p_value: String(v) });
      if (r !== "ok") alert("تعذّر: " + r);
      refresh();
    };
    return h("div", { class: "rv-card" },
      h("div", { class: "rv-row" }, h("b", {}, "رصيد الصوت والفيديو (LiveKit) هذا الشهر"), h("span", { class: "rv-sp" }),
        badge(`${u.used} / ${limit} دقيقة (${pct}%)`, color)),
      h("div", { style: "height:10px;border-radius:6px;background:var(--bg);margin:10px 0;overflow:hidden" }, h("div", { style: `height:100%;width:${Math.min(100, pct)}%;background:${color}` })),
      pct >= u.stop_pct ? h("div", { class: "rv-bad", style: "font-weight:800" }, "🔴 الصوت والفيديو مخفيان عن العملاء تلقائيًا. الشات شغال. رقّي الباقة أو استنى أول الشهر.")
        : pct >= u.alert_pct ? h("div", { style: `color:${AMBER};font-weight:800` }, `⚠ وصلت ${pct}% من الرصيد. قريبًا هيتوقف الصوت والفيديو تلقائيًا عند ${u.stop_pct}%.`) : null,
      h("div", { class: "rv-row", style: "margin-top:8px" },
        h("span", { class: "rv-mu" }, "الحد الشهري (دقيقة مشارك):"), lim, h("button", { class: "rv-btn ghost", onclick: () => save("rtc_monthly_limit_min", lim.value) }, "حفظ"),
        h("span", { class: "rv-sp" }),
        h("button", { class: "rv-btn " + (u.enabled ? "bad" : "ok"), onclick: () => save("rtc_enabled", !u.enabled) }, u.enabled ? "إيقاف الصوت والفيديو" : "تفعيل الصوت والفيديو")),
      h("div", { class: "rv-mu" }, "الدقيقة بتتحسب لكل مشارك (مكالمة 10 دقايق بين اتنين = 20 دقيقة)."));
  }

  async function renderConsults(root) {
    const filters = [["doctor", "بانتظار الدكتور"], ["pay", "في انتظار الدفع"], ["paid", "تم الدفع"], ["alerts", "تنبيهات"], ["live", "جارية"], ["ended", "منتهية"], ["cancelled", "ملغية"], ["all", "الكل"]];
    const gauge = await rtcGauge();
    if (gauge) root.append(gauge);
    root.append(h("div", { class: "rv-chips" }, filters.map(([k, n]) => h("button", { class: "rv-chip" + (state.conFilter === k ? " on" : ""), onclick: () => { state.conFilter = k; refresh(); } }, n))));
    const list = h("div");
    root.append(list);
    const { data, error } = await sb.rpc("admin_consultations");
    if (error) return list.replaceChildren(h("div", { class: "rv-empty" }, "خطأ: " + error.message));
    const f = state.conFilter;
    const rows = data.filter((c) =>
      f === "all" ? true : f === "doctor" ? c.pay_status === "pending" && c.doctor_status !== "accepted" : f === "pay" ? c.pay_status === "pending" && c.doctor_status === "accepted" : f === "paid" ? c.pay_status === "paid" && c.state === "wait" :
      f === "alerts" ? c.alerts.length > 0 : f === "live" ? c.state === "live" : f === "ended" ? c.state === "ended" : c.pay_status === "cancelled");
    if (!rows.length) return list.replaceChildren(h("div", { class: "rv-empty" }, "لا توجد استشارات"));
    const act = async (fn, args) => {
      const { data: r, error: e } = await sb.rpc(fn, args);
      if (e || (r && r !== "ok")) alert("تعذّر: " + (e?.message || r));
      refresh();
    };
    list.replaceChildren(...rows.map((c) => {
      const st = c.pay_status === "cancelled" ? (c.refunded ? "ملغي · تم الاسترداد" : "ملغي") : c.pay_status === "pending" ? (c.doctor_status === "pending" ? "بانتظار رد الدكتور" : c.doctor_status === "declined" ? "الدكتور اعتذر" : c.doctor_status === "expired" ? "الدكتور لم يرد" : c.prop_status === "ok" ? "في انتظار الدفع" : "بانتظار الموعد") : c.state === "live" ? "جارية" : c.state === "ended" ? (c.no_show ? (c.refunded ? "لم يحضر المريض · تم الاسترداد" : "لم يحضر المريض") : "منتهية") : "تم الدفع";
      const wa = "https://wa.me/20" + (c.client_phone || "").replace(/\D/g, "").replace(/^0/, "");
      const reason = h("select", { class: "rv-in" }, CANCEL_REASONS.map((r) => h("option", { value: r }, r)));
      const card = h("div", { class: "rv-card" },
        h("div", { class: "rv-row" }, h("b", {}, c.case_number), badge(st), h("span", { class: "rv-sp" }), h("span", { class: "rv-mu" }, fmt(c.created_at))),
        h("div", { class: "rv-row", style: "margin-top:6px" }, h("span", {}, "العميل: " + c.client_name), h("a", { href: wa, target: "_blank", rel: "noopener", style: "color:#8a6a14;font-weight:800" }, c.client_phone || ""), h("span", { class: "rv-sp" }), h("span", {}, "الطبيب: " + c.provider_name)),
        h("div", { class: "rv-mu" }, `${{ chat: "شات", voice: "صوت", video: "فيديو" }[c.channel]} · ${c.duration_min} د · ${c.price} ج.م · ${c.pay_method === "wallet" ? "محفظة" : "إنستاباي"} · ${c.period === "asap" ? PERIODS.asap : c.period_date + " " + PERIODS[c.period]}`),
        c.prev_provider_name ? h("div", { class: "rv-mu" }, "الطبيب السابق (اعتذر / لم يرد): " + c.prev_provider_name) : null,
        c.appt_at ? h("div", { class: "rv-mu" }, "الموعد المعتمد: " + fmt(c.appt_at)) : c.prop_at ? h("div", { class: "rv-mu" }, "موعد مقترح: " + fmt(c.prop_at)) : null,
        c.pay_status === "pending" && c.pay_deadline ? h("div", { class: "rv-mu" }, "مهلة الدفع: " + fmt(c.pay_deadline)) : null,
        c.cancel_reason ? h("div", { class: "rv-mu rv-bad" }, "سبب الإلغاء: " + c.cancel_reason) : null,
        c.alerts.length ? h("div", { class: "rv-row", style: "margin-top:6px" }, c.alerts.map((a) => badge(ALERTS[a], BAD))) : null,
        c.sum_at ? h("div", { class: "rv-sub rv-msg" },
          h("b", {}, "ملخص الدكتور"), h("br"), c.sum_note,
          c.sum_recs ? h("div", { class: "rv-mu", style: "margin-top:6px" }, "التوصيات: " + c.sum_recs) : null,
          h("div", { class: "rv-mu" }, "المتابعة: " + ({ none: "لا يلزم متابعة", week: "بعد أسبوع", two: "بعد أسبوعين", month: "بعد شهر" }[c.sum_follow] || c.sum_follow) + " · " + fmt(c.sum_at))) : (c.state === "ended" && !c.no_show ? h("div", { class: "rv-mu" }, "ملخص الدكتور: لم يُكتب بعد") : null),
        c.admin_contacted_at ? h("div", { class: "rv-mu rv-ok" }, "✓ تم التواصل مع الطبيب " + fmt(c.admin_contacted_at)) : null,
        c.refunded ? h("div", { class: "rv-row", style: "margin-top:6px" }, badge("تم الاسترداد", OK)) : null,
        c.rating ? h("div", { class: "rv-msg" }, "★".repeat(c.rating) + (c.rating_text ? " — " + c.rating_text : ""), " ", c.rating_ok ? badge("تم الاعتماد · منشور في صفحة الدكتور", OK) : c.rating_hidden ? badge("تم إلغاء النشر", BAD) : badge("بانتظار الاعتماد")) : null);
      const bar = h("div", { class: "rv-row", style: "margin-top:10px" });
      if (c.state === "wait" && c.pay_status !== "cancelled") {
        if (c.pay_status === "pending" && c.doctor_status === "accepted" && c.prop_status === "ok") bar.append(h("button", { class: "rv-btn ok", onclick: () => act("admin_set_payment", { p_id: c.id, p_status: "paid" }) }, "تم الدفع"));
        else if (c.pay_status === "pending") bar.append(h("span", { class: "rv-mu" }, c.doctor_status === "accepted" ? "الدفع بعد موافقة العميل على الموعد" : "الدفع بعد قبول الدكتور وموافقة العميل على الموعد"));
        else if (c.prop_status === "none") bar.append(h("button", { class: "rv-btn ghost", onclick: () => act("admin_set_payment", { p_id: c.id, p_status: "pending" }) }, "في انتظار الدفع"));
        bar.append(reason, h("button", { class: "rv-btn bad", onclick: () => confirm("إلغاء الاستشارة؟") && act("admin_set_payment", { p_id: c.id, p_status: "cancelled", p_reason: reason.value }) }, "إلغاء"));
      }
      if (c.state === "wait" && c.pay_status === "pending" && (c.doctor_status === "declined" || c.doctor_status === "expired")) {
        const pick = h("select", { class: "rv-in" }, h("option", { value: "" }, "اختر طبيبًا بديلًا..."));
        sb.rpc("admin_reassign_candidates", { p_id: c.id }).then(({ data: cand }) => (cand || []).forEach((d) => pick.append(h("option", { value: d.id }, d.name + (d.specialty ? " · " + d.specialty : "") + " · " + ({ chat: "شات", voice: "صوت", video: "فيديو" }[d.channel] || "") + " · " + d.price + " ج.م"))));
        bar.append(pick, h("button", { class: "rv-btn", onclick: () => {
          if (!pick.value) return alert("اختر الطبيب");
          if (confirm("تحويل الطلب لهذا الطبيب وإبلاغه والعميل؟")) act("admin_reassign_consultation", { p_id: c.id, p_provider: pick.value });
        } }, "تحويل لطبيب آخر"));
      }
      if (c.state === "wait" && c.pay_status !== "cancelled" && c.doctor_status === "accepted") {
        const when = h("input", { class: "rv-in", type: "datetime-local", dir: "ltr" });
        bar.append(when, h("button", { class: "rv-btn ghost", onclick: () => {
          if (!when.value) return alert("اختر التاريخ والوقت");
          if (confirm("تحديد الموعد وإبلاغ الطبيب والعميل؟")) act("admin_set_appointment", { p_id: c.id, p_at: new Date(when.value).toISOString() });
        } }, c.appt_at ? "تعديل الموعد" : "تحديد الموعد"));
      }
      if (c.prop_status === "no" || c.prop_status === "pending") bar.append(h("button", { class: "rv-btn ghost", onclick: () => act("admin_consultation_handled", { p_id: c.id }) }, "تم التواصل (السماح بموعد جديد)"));
      if (c.alerts.includes("doctor_late")) bar.append(h("button", { class: "rv-btn ghost", onclick: () => act("admin_doctor_contacted", { p_id: c.id }) }, "تم التواصل مع الطبيب"));
      if (c.alerts.includes("doctor_late") || (c.state === "wait" && c.admin_contacted_at && c.pay_status === "paid" && !c.refunded)) bar.append(h("button", { class: "rv-btn bad", onclick: () => confirm("إلغاء مع الاسترداد؟") && act("admin_refund_consultation", { p_id: c.id, p_cancel: true, p_reason: "الطبيب لم يحضر" }) }, "إلغاء مع الاسترداد"));
      if (c.no_show && !c.refunded) bar.append(h("button", { class: "rv-btn ghost", onclick: () => confirm("استرداد استثنائي؟") && act("admin_refund_consultation", { p_id: c.id }) }, "استرداد استثنائي"));
      if (c.rating && !c.rating_ok) bar.append(h("button", { class: "rv-btn", onclick: () => act("admin_approve_rating", { p_id: c.id }) }, c.rating_hidden ? "إعادة النشر" : "اعتماد التقييم"));
      if (c.rating && c.rating_ok) bar.append(h("button", { class: "rv-btn bad", onclick: () => confirm("إلغاء نشر التقييم من صفحة الدكتور؟") && act("admin_unpublish_rating", { p_id: c.id }) }, "إلغاء النشر"));
      if (bar.children.length) card.append(bar);
      return card;
    }));
  }

  // ───────── حجوزات متأخرة (مؤكدة، موعدها عدّى، ولم تُغلق) ─────────
  async function renderLate(root) {
    root.append(h("div", { class: "rv-mu", style: "margin-bottom:10px" }, "حجوزات المقدم وافق عليها لكن لم يتم إغلاقها (مكتمل أو ملغي) بعد مرور 3 ساعات على نهاية فترة الموعد. المقدم بيوصله تنبيه بعد 3 ساعات وتنبيه تاني مع إنذار هنا بعد 24 ساعة. الإغلاق بيتم بقرار منك فقط."));
    const list = h("div");
    root.append(list);
    const { data, error } = await sb.from("bookings").select("*, providers(name, phone)").eq("status", "confirmed").order("created_at", { ascending: false }).limit(500);
    if (error) return list.replaceChildren(h("div", { class: "rv-empty" }, "خطأ: " + error.message));
    const now = Date.now(), HR = 3600 * 1000;
    // الحجوزات القديمة قبل إضافة appointment_at: الاستحقاق بعد يومين من وقت التسجيل
    const rows = data.map((b) => ({ b, due: b.appointment_at ? new Date(b.appointment_at).getTime() : new Date(b.created_at).getTime() + 48 * HR, legacy: !b.appointment_at }))
      .filter((r) => now - r.due > 3 * HR).sort((x, y) => x.due - y.due);
    if (!rows.length) return list.replaceChildren(h("div", { class: "rv-empty" }, "لا توجد حجوزات متأخرة 👌"));
    const close = async (id, status) => {
      const patch = status === "cancelled" ? { status, cancel_reason: "أُغلق بواسطة الإدارة" } : { status };
      const { error: e } = await sb.from("bookings").update(patch).eq("id", id);
      if (e) alert("تعذّر: " + e.message);
      refresh();
    };
    list.replaceChildren(...rows.map(({ b, due, legacy }) => {
      const hours = Math.floor((now - due) / HR);
      const late = hours >= 72 ? BAD : hours >= 24 ? AMBER : GOLD;
      const prov = b.providers;
      const wa = prov?.phone ? "https://wa.me/20" + String(prov.phone).replace(/\D/g, "").replace(/^0/, "") : null;
      return h("div", { class: "rv-card" },
        h("div", { class: "rv-row" }, h("b", {}, b.patient_name || "—"), badge("متأخر " + (hours >= 48 ? Math.floor(hours / 24) + " يوم" : hours + " ساعة"), late), legacy ? badge("حجز قديم", "#6b7c80") : null,
          h("span", { class: "rv-sp" }), h("span", { class: "rv-mu" }, "سُجّل " + fmt(b.created_at))),
        h("div", { class: "rv-mu" }, [b.service_type, b.sub_option, b.area].filter(Boolean).join(" · ")),
        h("div", { class: "rv-mu" }, "الموعد: " + (b.appointment_time || "—") + (b.appointment_at ? " · " + fmt(b.appointment_at) : "")),
        h("div", { class: "rv-row", style: "margin-top:6px" }, h("span", {}, "المقدم: " + (prov?.name || "—")), wa ? h("a", { href: wa, target: "_blank", rel: "noopener", style: "color:#8a6a14;font-weight:800" }, prov.phone) : null,
          b.price != null ? h("span", { class: "rv-mu" }, b.price + " ج.م") : null),
        h("div", { class: "rv-row", style: "margin-top:10px" },
          h("button", { class: "rv-btn ok", onclick: () => confirm("تأكيد إن الخدمة تمت (مكتمل)؟ العميل هيوصله طلب تقييم.") && close(b.id, "completed") }, "تمت الخدمة (مكتمل)"),
          h("button", { class: "rv-btn bad", onclick: () => confirm("إلغاء الحجز؟") && close(b.id, "cancelled") }, "إلغاء الحجز")));
    }));
  }

  // ───────── الأسماء بالإنجليزي (مقدمو الخدمة، التخصصات والخدمات، المحافظات، المدن) ─────────
  async function renderNames(root) {
    root.append(h("div", { class: "rv-mu", style: "margin-bottom:10px" }, "الاسم بالإنجليزي بيظهر في التطبيق لما اللغة تبقى إنجليزي. لو سبته فاضي، التطبيق بيحوّل الاسم العربي تلقائيًا (جودة أقل). الحفظ بيتم فورًا."));
    const search = h("input", { class: "rv-in", placeholder: "بحث بالاسم…", value: state.nameQuery, style: "min-width:200px" });
    search.addEventListener("input", () => { state.nameQuery = search.value.trim(); applyFilter(); });
    const chips = h("div", { class: "rv-chips" }, [["all", "الكل"], ["missing", "الناقص فقط"]].map(([k, n]) =>
      h("button", { class: "rv-chip" + (state.nameFilter === k ? " on" : ""), onclick: () => { state.nameFilter = k; refresh(); } }, n)), search);
    root.append(chips);

    const [prov, subs, govs, areas] = await Promise.all([
      sb.from("providers").select("id,name,name_en,service_type,specialty").order("name").limit(1000),
      sb.from("sub_services").select("id,name,name_en,service_name,group_name").order("service_name").order("name").limit(1000),
      sb.from("governorates").select("id,name,name_en").order("name").limit(500),
      sb.from("coverage_areas").select("id,name,name_en,city").order("name").limit(2000),
    ]);
    const err = [prov, subs, govs, areas].find((r) => r.error);
    if (err) return root.append(h("div", { class: "rv-empty" }, "خطأ: " + err.error.message));

    const sections = [];
    const section = (title, rows, saveFn, hint) => {
      const missing = rows.filter((r) => !r.name_en).length;
      const box = h("div", { class: "rv-card" }, h("div", { class: "rv-row" }, h("b", { style: "font-size:16px" }, title), badge(missing ? `${missing} ناقص` : "مكتمل", missing ? AMBER : OK)));
      const items = [];
      for (const r of rows) {
        const input = h("input", { class: "rv-in", value: r.name_en || "", placeholder: "English", dir: "ltr", style: "width:230px" });
        const btn = h("button", { class: "rv-btn ghost", onclick: async () => {
          const res = await saveFn(r, input.value.trim());
          if (res) alert("تعذّر الحفظ: " + res); else { r.name_en = input.value.trim(); btn.textContent = "تم ✓"; setTimeout(() => (btn.textContent = "حفظ"), 1200); }
        } }, "حفظ");
        input.addEventListener("keydown", (e) => e.key === "Enter" && btn.click());
        const row = h("div", { class: "rv-row", style: "padding:6px 0;border-top:1px solid var(--border)" },
          h("b", {}, r.name), hint ? h("span", { class: "rv-mu" }, hint(r)) : null, h("span", { class: "rv-sp" }), input, btn);
        row._r = r; items.push(row);
      }
      box.append(...items);
      sections.push({ box, items });
      return box;
    };
    const direct = (table) => async (r, v) => { const { error } = await sb.from(table).update({ name_en: v || null }).eq("id", r.id); return error?.message; };
    root.append(
      section("مقدمو الخدمة", prov.data, async (r, v) => { const { data, error } = await sb.rpc("admin_set_provider_name_en", { p_id: r.id, p_name_en: v }); return error?.message || (data !== "ok" ? data : null); }, (r) => [r.service_type, r.specialty].filter(Boolean).join(" · ")),
      section("التخصصات والخدمات الفرعية", subs.data, direct("sub_services"), (r) => r.service_name + (r.group_name ? " · " + r.group_name : "")),
      section("المحافظات", govs.data, direct("governorates")),
      section("المدن والمناطق", areas.data, direct("coverage_areas"), (r) => r.city || ""));

    function applyFilter() {
      const q = state.nameQuery.toLowerCase();
      for (const s of sections) for (const row of s.items) {
        const r = row._r;
        const okQ = !q || (r.name || "").toLowerCase().includes(q) || (r.name_en || "").toLowerCase().includes(q);
        const okM = state.nameFilter !== "missing" || !r.name_en;
        row.style.display = okQ && okM ? "" : "none";
      }
    }
    applyFilter();
  }

  // ───────── العملاء (كل العملاء + نشاط كل عميل) ─────────
  // جدول clients محمي (العميل يقرأ صفه بس)، فالقراءة من دالتين للأدمن بس: admin_clients / admin_client_detail
  const BK_STATUS = { pending: "قيد الانتظار", confirmed: "مؤكد", on_way: "في الطريق", completed: "مكتمل", cancelled: "ملغي", rejected: "مرفوض" };
  const BK_COLOR = { pending: AMBER, confirmed: BLUE, on_way: BLUE, completed: OK, cancelled: BAD, rejected: BAD };
  const SRV = { chat: "شات", voice: "صوت", video: "فيديو" };
  const conStatus = (k) => k.pay_status === "cancelled" ? ["ملغية", BAD]
    : k.doctor_status === "pending" ? ["بانتظار رد الدكتور", AMBER]
    : k.doctor_status === "declined" || k.doctor_status === "expired" ? ["الدكتور لم يقبل", BAD]
    : k.state === "live" ? ["جارية", BLUE]
    : k.state === "ended" ? [k.no_show ? "لم يحضر" : "منتهية", k.no_show ? BAD : OK]
    : k.pay_status === "pending" ? [k.prop_status === "ok" ? "في انتظار الدفع" : "بانتظار الموعد", AMBER]
    : ["مؤكدة", OK];
  const ASK_STATUS = { new: "جديد", routed: "موجّه", answered: "تم الرد", expired: "انتهت المهلة", closed: "مغلق" };

  async function loadClients() {
    const page = document.getElementById("page-clients");
    if (!page) return;
    let root = document.getElementById("rv-clients-root");
    if (!root) { root = h("div", { id: "rv-clients-root" }); page.replaceChildren(root); }
    root.replaceChildren(h("div", { class: "rv-empty" }, "جاري التحميل…"));
    if (!(await ensureAdmin())) return root.replaceChildren(h("div", { class: "rv-empty rv-bad" }, "هذا الحساب ليس أدمن (جدول admin_users)."));
    const { data, error } = await sb.rpc("admin_clients");
    if (error) return root.replaceChildren(h("div", { class: "rv-empty" }, "خطأ: " + error.message + " (شغّل ملف 40 على قاعدة البيانات)"));
    const rows = data || [];
    const st = { q: "", f: "all" };
    const list = h("div");
    const search = h("input", { class: "rv-in", placeholder: "بحث باسم أو إيميل أو هاتف…", style: "width:280px" });
    const chips = h("div", { class: "rv-chips", style: "margin:0" });
    const FILT = [["all", "الكل"], ["booking", "عندهم حجوزات"], ["consult", "عندهم استشارات"], ["none", "بدون نشاط"]];
    const count = h("span", { class: "rv-mu" });

    function draw() {
      const q = st.q.toLowerCase();
      const shown = rows.filter((c) =>
        (!q || (c.name || "").toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q) || (c.phone || "").includes(q)) &&
        (st.f === "all" || (st.f === "booking" && c.bookings_count > 0) || (st.f === "consult" && c.consults_count > 0) ||
         (st.f === "none" && !c.bookings_count && !c.consults_count && !c.asks_count)));
      count.textContent = `${shown.length} من ${rows.length} عميل`;
      chips.replaceChildren(...FILT.map(([k, n]) => h("button", { class: "rv-chip" + (st.f === k ? " on" : ""), onclick: () => { st.f = k; draw(); } }, n)));
      if (!shown.length) return list.replaceChildren(h("div", { class: "rv-empty" }, "لا يوجد عملاء"));
      list.replaceChildren(...shown.map(clientCard));
    }

    function clientCard(c) {
      const body = h("div");
      let loaded = false;
      const card = h("div", { class: "rv-card" });
      const head = h("div", { class: "rv-row", style: "cursor:pointer" },
        h("b", {}, c.name || "—"), badge(c.auth_id ? "مسجّل بحساب" : "ضيف (حجز بدون حساب)", c.auth_id ? OK : AMBER),
        h("span", { class: "rv-sp" }),
        h("span", { class: "rv-mu" }, `حجوزات ${c.bookings_count} · استشارات ${c.consults_count} · أسئلة ${c.asks_count}`));
      card.append(head,
        h("div", { class: "rv-mu" }, [c.phone, c.email].filter(Boolean).join(" · ")),
        h("div", { class: "rv-mu" }, "سجّل: " + (c.created_at ? fmt(c.created_at) : "—") + (c.last_activity ? " · آخر نشاط: " + fmt(c.last_activity) : "")),
        body);
      head.addEventListener("click", async () => {
        if (loaded) { body.hidden = !body.hidden; return; }
        loaded = true;
        body.replaceChildren(h("div", { class: "rv-mu" }, "جاري التحميل…"));
        const { data: d, error: e } = await sb.rpc("admin_client_detail", { p_id: c.id });
        if (e || !d) return body.replaceChildren(h("div", { class: "rv-bad" }, "خطأ: " + (e?.message || "تعذّر التحميل")));
        renderDetail(body, c, d);
      });
      return card;
    }

    function renderDetail(body, c, d) {
      const bkSel = h("select", { class: "rv-in" }, [["all", "كل حالات الحجوزات"], ...Object.entries(BK_STATUS)].map(([k, n]) => h("option", { value: k }, n)));
      const bkList = h("div");
      const drawBk = () => {
        const items = d.bookings.filter((b) => bkSel.value === "all" || b.status === bkSel.value);
        bkList.replaceChildren(...(items.length ? items.map((b) => h("div", { class: "rv-row", style: "padding:6px 0;border-top:1px solid var(--border)" },
          h("b", {}, [b.service_type, b.sub_option].filter(Boolean).join(" · ")),
          badge(BK_STATUS[b.status] || b.status, BK_COLOR[b.status]),
          h("span", { class: "rv-sp" }),
          h("span", { class: "rv-mu" }, [b.provider_name ? "الطبيب/المقدم: " + b.provider_name : "بدون مقدم", b.price != null ? b.price + " ج.م" : null,
            b.appointment_at ? fmt(b.appointment_at) : b.appointment_time, "سُجّل " + fmt(b.created_at)].filter(Boolean).join(" · ")))) : [h("div", { class: "rv-mu" }, "لا توجد حجوزات")]));
      };
      bkSel.addEventListener("change", drawBk); drawBk();
      const cons = d.consultations.length ? d.consultations.map((k) => { const [t, col] = conStatus(k); return h("div", { class: "rv-row", style: "padding:6px 0;border-top:1px solid var(--border)" },
        h("b", {}, k.case_number), badge(t, col), h("span", { class: "rv-sp" }),
        h("span", { class: "rv-mu" }, [SRV[k.channel], k.provider_name, k.price + " ج.م", k.appt_at ? fmt(k.appt_at) : null, "سُجّل " + fmt(k.created_at)].filter(Boolean).join(" · "))); })
        : [h("div", { class: "rv-mu" }, "لا توجد استشارات")];
      const asks = d.asks.length ? d.asks.map((a) => h("div", { class: "rv-row", style: "padding:6px 0;border-top:1px solid var(--border)" },
        h("b", {}, a.case_number), badge(ASK_STATUS[a.status] || a.status), h("span", { class: "rv-sp" }), h("span", { class: "rv-mu" }, (a.message || "") + " · " + fmt(a.created_at))))
        : [h("div", { class: "rv-mu" }, "لا توجد أسئلة")];
      const del = typeof window.deleteClient === "function" ? h("button", { class: "rv-btn bad", onclick: () => window.deleteClient(c.id, c.email || "").then?.(() => loadClients()) }, "حذف العميل نهائيًا") : null;
      body.replaceChildren(h("div", { class: "rv-sub" },
        h("div", { class: "rv-row" }, h("b", {}, "الحجوزات المنزلية (" + d.bookings.length + ")"), h("span", { class: "rv-sp" }), bkSel), bkList,
        h("b", { style: "display:block;margin-top:12px" }, "الاستشارات الأونلاين (" + d.consultations.length + ")"), ...cons,
        h("b", { style: "display:block;margin-top:12px" }, "اسأل طبيب (" + d.asks.length + ")"), ...asks,
        del ? h("div", { style: "margin-top:12px" }, del) : null));
    }

    search.addEventListener("input", () => { st.q = search.value; draw(); });
    root.replaceChildren(
      h("div", { class: "rv-row", style: "margin-bottom:12px" }, h("b", { style: "font-size:17px" }, "العملاء"), count, h("span", { class: "rv-sp" }), search),
      chips, list);
    draw();
  }

  window.RV = { load, loadClients };

})();
