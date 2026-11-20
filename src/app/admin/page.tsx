"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Overview {
  rooms: number;
  realRooms: number;
  demoRooms: number;
  revealedRooms: number;
  participants: number;
  assessments: number;
  submittedAssessments: number;
  answers: number;
  roomsLast24h: number;
  roomsLast7d: number;
  participantsLast24h: number;
  accounts: number;
  accountsLast7d: number;
  surveys: number;
  surveyResponses: number;
}

interface UserRow {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  activeSessions: number;
  survey: { code: string; displayName: string; selfType: string; status: string } | null;
  responsesReceived: number;
  answersGiven: number;
}

interface UserDetail {
  user: { id: string; email: string; createdAt: string; linkedBrowsers: number };
  sessions: Array<{ createdAt: string; expiresAt: string; active: boolean }>;
  survey: {
    code: string;
    displayName: string;
    selfType: string;
    selfTestType: string | null;
    status: string;
    boardPublic: boolean;
    notify: boolean;
    notifiedLevel: number;
    locale: string;
    createdAt: string;
    responses: Array<{ name: string; relation: string; type: string; signedIn: boolean; submittedAt: string }>;
  } | null;
  answersGiven: Array<{ surveyCode: string; ownerName: string; answeredAs: string; relation: string; type: string; submittedAt: string }>;
}

const RELATION_LABEL: Record<string, string> = {
  family: "Family",
  close_friend: "Close friend",
  classmate: "Classmate",
  colleague: "Colleague",
  online: "Online friend",
  other: "Other",
};

interface RoomRow {
  id: string;
  code: string;
  status: "lobby" | "survey" | "revealed";
  isDemo: boolean;
  createdAt: string;
  participants: number;
  assessments: number;
  submitted: number;
}

interface RoomDetail {
  room: {
    id: string;
    code: string;
    status: string;
    isDemo: boolean;
    createdAt: string;
    questionnaireVersion: string;
  };
  participants: Array<{ id: string; nickname: string; createdAt: string }>;
  assessments: Array<{
    id: string;
    reviewer: string;
    target: string;
    isSelf: boolean;
    status: string;
    submittedAt: string | null;
    answerCount: number;
  }>;
  answers?: Array<{ assessmentId: string; questionId: number; value: number }>;
}

const STATUS_LABEL: Record<string, string> = {
  lobby: "Lobby",
  survey: "Survey",
  revealed: "Revealed",
};

function formatWhen(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function csvEscape(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export default function AdminPage() {
  const [configured, setConfigured] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [checking, setChecking] = useState(true);
  const [token, setToken] = useState("");
  const [loginError, setLoginError] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<RoomDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailRef = useRef<HTMLElement | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(0);
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const userDetailRef = useRef<HTMLElement | null>(null);

  const limit = 50;

  const loadOverview = useCallback(async () => {
    const response = await fetch("/api/admin/overview", { cache: "no-store" });
    if (response.status === 401) return setSignedIn(false);
    if (response.ok) setOverview(await response.json());
  }, []);

  const loadRooms = useCallback(async () => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(page * limit),
    });
    if (search.trim()) params.set("q", search.trim());
    if (statusFilter) params.set("status", statusFilter);
    const response = await fetch(`/api/admin/rooms?${params}`, { cache: "no-store" });
    if (response.status === 401) return setSignedIn(false);
    if (response.ok) {
      const body = await response.json();
      setRooms(body.rooms);
      setTotal(body.total);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    (async () => {
      const session = await fetch("/api/admin/session", { cache: "no-store" });
      if (session.status === 404) {
        setConfigured(false);
        setChecking(false);
        return;
      }
      const probe = await fetch("/api/admin/overview", { cache: "no-store" });
      if (probe.ok) {
        setSignedIn(true);
        setOverview(await probe.json());
      }
      setChecking(false);
    })();
  }, []);

  const loadUsers = useCallback(async () => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(userPage * limit) });
    if (userSearch.trim()) params.set("q", userSearch.trim());
    const response = await fetch(`/api/admin/users?${params}`, { cache: "no-store" });
    if (response.status === 401) return setSignedIn(false);
    if (response.ok) {
      const body = await response.json();
      setUsers(body.users);
      setUserTotal(body.total);
    }
  }, [userPage, userSearch]);

  async function openUser(id: string) {
    setUserLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, { cache: "no-store" });
      if (response.ok) setUserDetail(await response.json());
    } finally {
      setUserLoading(false);
    }
  }

  useEffect(() => {
    if (userDetail) userDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [userDetail]);

  useEffect(() => {
    if (!signedIn) return;
    loadOverview();
    loadRooms();
  }, [signedIn, loadOverview, loadRooms]);

  useEffect(() => {
    if (signedIn) loadUsers();
  }, [signedIn, loadUsers]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setLoginError("");
    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setLoginError(body?.error || "Sign-in failed.");
      return;
    }
    setToken("");
    setSignedIn(true);
  }

  async function signOut() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setSignedIn(false);
    setOverview(null);
    setRooms([]);
    setDetail(null);
    setUsers([]);
    setUserDetail(null);
  }

  async function openRoom(code: string) {
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/admin/rooms/${code}`, { cache: "no-store" });
      if (response.ok) setDetail(await response.json());
    } finally {
      setDetailLoading(false);
    }
  }

  async function exportRoom(code: string, format: "json" | "csv") {
    const response = await fetch(`/api/admin/rooms/${code}?answers=1`, { cache: "no-store" });
    if (!response.ok) return;
    const data: RoomDetail = await response.json();
    let blob: Blob;
    if (format === "json") {
      blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    } else {
      const names = new Map(data.participants.map((p) => [p.id, p.nickname]));
      const assessmentById = new Map(data.assessments.map((a) => [a.id, a]));
      const lines = ["assessment_id,reviewer,target,is_self,status,question_id,value"];
      for (const answer of data.answers || []) {
        const assessment = assessmentById.get(answer.assessmentId);
        lines.push(
          [
            answer.assessmentId,
            assessment?.reviewer ?? "",
            assessment?.target ?? "",
            assessment?.isSelf ? "self" : "friend",
            assessment?.status ?? "",
            answer.questionId,
            answer.value,
          ]
            .map(csvEscape)
            .join(","),
        );
      }
      void names;
      blob = new Blob([lines.join("\n")], { type: "text/csv" });
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `aster-room-${code}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    if (detail) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [detail]);

  if (!configured) {
    return (
      <main className="admin-main">
        <section className="admin-box">
          <span className="eyebrow">Aster Admin</span>
          <h1>Not configured</h1>
          <p className="form-error">Set the ADMIN_TOKEN secret on the Worker to enable this console.</p>
        </section>
      </main>
    );
  }

  if (checking) {
    return <main className="admin-main admin-center">Checking session…</main>;
  }

  if (!signedIn) {
    return (
      <main className="admin-main">
        <form className="admin-login" onSubmit={signIn}>
          <span className="eyebrow">Aster Admin</span>
          <h1>Enter the admin token</h1>
          <label className="field">
            Admin token
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              autoFocus
              autoComplete="off"
            />
          </label>
          {loginError ? <p className="form-error">{loginError}</p> : null}
          <button className="button primary" type="submit">
            Sign in
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="admin-main">
      <header className="admin-head">
        <div>
          <span className="eyebrow">Aster Admin</span>
          <h1>Console</h1>
        </div>
        <div className="admin-head-actions">
          <button className="button secondary" onClick={() => { loadOverview(); loadRooms(); loadUsers(); }}>
            Refresh
          </button>
          <button className="button secondary" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      {overview ? (
        <section className="admin-stats">
          {[
            ["Rooms", overview.realRooms, `${overview.demoRooms} demo · ${overview.roomsLast24h} new in 24h`],
            ["Participants", overview.participants, `${overview.participantsLast24h} in 24h`],
            ["Assessments", overview.assessments, `${overview.submittedAssessments} submitted`],
            ["Answers", overview.answers, `${overview.revealedRooms} rooms revealed`],
            ["Rooms (7d)", overview.roomsLast7d, ""],
            ["Accounts", overview.accounts, `${overview.accountsLast7d} new in 7d · ${overview.surveys} surveys`],
            ["Survey answers", overview.surveyResponses, "answers to open-link surveys"],
          ].map(([label, value, note]) => (
            <article key={label as string} className="admin-stat">
              <span className="card-kicker">{label as string}</span>
              <strong>{(value as number).toLocaleString()}</strong>
              {note ? <small>{note}</small> : null}
            </article>
          ))}
        </section>
      ) : null}

      <section className="admin-tools">
        <label className="field admin-search">
          Room code
          <input
            className="code-input"
            placeholder="ABC123"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value.toUpperCase());
              setPage(0);
            }}
          />
        </label>
        <label className="field admin-status">
          Status
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }}>
            <option value="">All</option>
            <option value="lobby">Lobby</option>
            <option value="survey">Survey</option>
            <option value="revealed">Revealed</option>
          </select>
        </label>
        <label className="field admin-demo">
          <input
            type="checkbox"
            onChange={(event) => {
              const params = new URLSearchParams({ limit: String(limit), offset: "0", demo: event.target.checked ? "1" : "0" });
              params.set("demo", event.target.checked ? "1" : "0");
              fetch(`/api/admin/rooms?${params}`, { cache: "no-store" });
            }}
          />
          Show demo rooms
        </label>
        <small className="admin-total">{total.toLocaleString()} rooms</small>
      </section>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Status</th>
            <th>People</th>
            <th>Submitted</th>
            <th>Created</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => (
            <tr key={room.id} className={detail?.room.code === room.code ? "admin-active-row" : undefined}>
              <td className="admin-code">
                {room.code}
                {room.isDemo ? <em className="admin-demo-tag">demo</em> : null}
              </td>
              <td>{STATUS_LABEL[room.status]}</td>
              <td>{room.participants}</td>
              <td>
                {room.assessments ? `${room.submitted}/${room.assessments}` : "—"}
              </td>
              <td>{new Date(room.createdAt).toLocaleString()}</td>
              <td>
                <button
                  className="button secondary admin-open"
                  onClick={() => openRoom(room.code)}
                  disabled={detailLoading}
                >
                  {detailLoading ? "Loading…" : "Open"}
                </button>
              </td>
            </tr>
          ))}
          {rooms.length === 0 ? (
            <tr>
              <td colSpan={6}>No rooms match.</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <nav className="admin-pager">
        <button className="button secondary" disabled={page === 0} onClick={() => setPage((p) => Math.max(p - 1, 0))}>
          Previous
        </button>
        <span>Page {page + 1}</span>
        <button
          className="button secondary"
          disabled={(page + 1) * limit >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </nav>

      {detail ? (
        <section className="admin-detail" ref={detailRef}>
          <h2>
            Room <span className="admin-code-inline">{detail.room.code}</span>
            <em className="admin-demo-tag">{STATUS_LABEL[detail.room.status]}</em>
          </h2>
          <p className="admin-meta">
            Created {new Date(detail.room.createdAt).toLocaleString()} · {detail.participants.length} people ·
            questionnaire {detail.room.questionnaireVersion}
          </p>

          <h3>Participants</h3>
          <ul className="admin-list">
            {detail.participants.map((participant) => (
              <li key={participant.id}>
                <strong>{participant.nickname}</strong>
                <span>joined {new Date(participant.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>

          <h3>Assessments</h3>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Reviewer</th>
                <th>Target</th>
                <th>Type</th>
                <th>Status</th>
                <th>Answers</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {detail.assessments.map((assessment) => (
                <tr key={assessment.id}>
                  <td>{assessment.reviewer}</td>
                  <td>{assessment.target}</td>
                  <td>{assessment.isSelf ? "Self" : "Friend"}</td>
                  <td>{assessment.status}</td>
                  <td>{assessment.answerCount}/50</td>
                  <td>{assessment.submittedAt ? new Date(assessment.submittedAt).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="admin-export">
            <button className="button secondary" onClick={() => exportRoom(detail.room.code, "csv")}>
              Export answers (CSV)
            </button>
            <button className="button secondary" onClick={() => exportRoom(detail.room.code, "json")}>
              Export room (JSON)
            </button>
            <button className="button secondary" onClick={() => setDetail(null)}>
              Close
            </button>
          </div>
        </section>
      ) : null}
      <section className="admin-accounts">
        <h2 className="admin-section-title">Accounts</h2>
        <div className="admin-tools">
          <label className="field admin-search">
            Email
            <input
              type="search"
              placeholder="name@example.com"
              value={userSearch}
              onChange={(event) => {
                setUserSearch(event.target.value);
                setUserPage(0);
              }}
            />
          </label>
          <small className="admin-total">{userTotal.toLocaleString()} accounts</small>
        </div>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Survey</th>
              <th>Answers received</th>
              <th>Answers given</th>
              <th>Last sign-in</th>
              <th>Joined</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className={userDetail?.user.id === user.id ? "admin-active-row" : undefined}>
                <td>{user.email}</td>
                <td>
                  {user.survey ? (
                    <>
                      <span className="admin-code-inline">{user.survey.code}</span> {user.survey.displayName} · {user.survey.selfType}
                      {user.survey.status === "closed" ? <em className="admin-demo-tag">closed</em> : null}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td>{user.survey ? user.responsesReceived : "—"}</td>
                <td>{user.answersGiven}</td>
                <td>
                  {user.lastSignInAt ? formatWhen(user.lastSignInAt) : "—"}
                  {user.activeSessions ? <small className="admin-subtle"> · {user.activeSessions} active</small> : null}
                </td>
                <td>{formatWhen(user.createdAt)}</td>
                <td>
                  <button className="button secondary admin-open" onClick={() => openUser(user.id)} disabled={userLoading}>
                    {userLoading ? "Loading…" : "Open"}
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 ? (
              <tr>
                <td colSpan={7}>No accounts match.</td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <nav className="admin-pager">
          <button className="button secondary" disabled={userPage === 0} onClick={() => setUserPage((p) => Math.max(p - 1, 0))}>
            Previous
          </button>
          <span>Page {userPage + 1}</span>
          <button className="button secondary" disabled={(userPage + 1) * limit >= userTotal} onClick={() => setUserPage((p) => p + 1)}>
            Next
          </button>
        </nav>

        {userDetail ? (
          <section className="admin-detail" ref={userDetailRef}>
            <h2>{userDetail.user.email}</h2>
            <p className="admin-meta">
              Joined {formatWhen(userDetail.user.createdAt)} · {userDetail.sessions.filter((session) => session.active).length} active
              session(s) · {userDetail.user.linkedBrowsers} linked browser(s) · id {userDetail.user.id}
            </p>

            <h3>Their survey</h3>
            {userDetail.survey ? (
              <>
                <p className="admin-meta">
                  <span className="admin-code-inline">{userDetail.survey.code}</span> as <strong>{userDetail.survey.displayName}</strong> ·
                  sees themselves as <strong>{userDetail.survey.selfType}</strong>
                  {userDetail.survey.selfTestType && userDetail.survey.selfTestType !== userDetail.survey.selfType
                    ? ` (their own answers score ${userDetail.survey.selfTestType})`
                    : ""}{" "}
                  · {userDetail.survey.status} · ranking {userDetail.survey.boardPublic ? "public" : "private"} · emails{" "}
                  {userDetail.survey.notify
                    ? userDetail.survey.notifiedLevel
                      ? `on (last sent at ${userDetail.survey.notifiedLevel} answers)`
                      : "on (none sent yet)"
                    : "off"}{" "}
                  ·{" "}
                  {userDetail.survey.locale} · created {formatWhen(userDetail.survey.createdAt)}
                </p>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Answered as</th>
                      <th>Relation</th>
                      <th>Type given</th>
                      <th>Signed in</th>
                      <th>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userDetail.survey.responses.map((response, index) => (
                      <tr key={`${response.name}-${index}`}>
                        <td>{response.name}</td>
                        <td>{RELATION_LABEL[response.relation] ?? response.relation}</td>
                        <td>{response.type}</td>
                        <td>{response.signedIn ? "Yes" : "No"}</td>
                        <td>{formatWhen(response.submittedAt)}</td>
                      </tr>
                    ))}
                    {userDetail.survey.responses.length === 0 ? (
                      <tr>
                        <td colSpan={5}>No answers yet.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </>
            ) : (
              <p className="admin-meta">No survey.</p>
            )}

            <h3>Surveys they answered</h3>
            {userDetail.answersGiven.length ? (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Survey</th>
                    <th>For</th>
                    <th>Answered as</th>
                    <th>Relation</th>
                    <th>Type given</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {userDetail.answersGiven.map((answer, index) => (
                    <tr key={`${answer.surveyCode}-${index}`}>
                      <td className="admin-code">{answer.surveyCode}</td>
                      <td>{answer.ownerName}</td>
                      <td>{answer.answeredAs}</td>
                      <td>{RELATION_LABEL[answer.relation] ?? answer.relation}</td>
                      <td>{answer.type}</td>
                      <td>{formatWhen(answer.submittedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="admin-meta">None while signed in.</p>
            )}

            <h3>Sign-ins</h3>
            <ul className="admin-list">
              {userDetail.sessions.map((session, index) => (
                <li key={index}>
                  <strong>{formatWhen(session.createdAt)}</strong>
                  <span>{session.active ? `active until ${formatWhen(session.expiresAt)}` : "expired"}</span>
                </li>
              ))}
              {userDetail.sessions.length === 0 ? <li><span>No sessions.</span></li> : null}
            </ul>

            <div className="admin-export">
              <button className="button secondary" onClick={() => setUserDetail(null)}>
                Close
              </button>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
