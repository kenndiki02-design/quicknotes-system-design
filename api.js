"use strict";

// ---------------------------------------------------------------------------
// QuickNotes API client (talks to the JSONPlaceholder practice API)
// ---------------------------------------------------------------------------

const API_URL = "https://jsonplaceholder.typicode.com/posts";
const MAX_TITLE_LENGTH = 100;

const loadBtn = document.getElementById("load-btn");
const statusEl = document.getElementById("status");
const notesList = document.getElementById("notes-list");

// ---- Page helpers ---------------------------------------------------------

/** Show a message. type is "loading", "success" or "error". */
function setStatus(message, type) {
  statusEl.textContent = message; // textContent only, never innerHTML
  statusEl.className = type ? `status status-${type}` : "status";
}

/** Disable (or re-enable) every button while a request is running. */
function setBusy(isBusy) {
  document.querySelectorAll("button").forEach((button) => {
    button.disabled = isBusy;
  });
}

/** Turn an error into a message a person can act on. */
function friendlyError(error, action) {
  if (error.status >= 500) {
    return `The server had a problem while ${action}. Please try again in a moment.`;
  }
  if (error.status) {
    return `Could not finish ${action} (status ${error.status}).`;
  }
  return `Could not reach the server while ${action}. Check your connection and try again.`;
}

// ---- Reusable request function -------------------------------------------

/**
 * Calls fetch, checks response.ok and throws on errors.
 * Returns { status, data } so callers can show the status code.
 */
async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    ...options,
  });

  if (!response.ok) {
    const error = new Error(`Request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null; // an empty body is fine
  }
  return { status: response.status, data };
}

// ---- Rendering ------------------------------------------------------------

function showEmpty() {
  const item = document.createElement("li");
  item.className = "empty";
  item.textContent = "No notes yet. Load notes or create one below.";
  notesList.replaceChildren(item);
}

function removeEmptyMessage() {
  const empty = notesList.querySelector("li.empty");
  if (empty) empty.remove();
}

function createNoteItem(note) {
  const item = document.createElement("li");
  item.dataset.id = note.id;

  const title = document.createElement("h3");
  title.textContent = note.title;

  const body = document.createElement("p");
  body.textContent = note.body || "";

  item.append(title, body);
  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = "Delete";
  deleteBtn.addEventListener("click", () => deleteNote(note.id, item));
  item.append(deleteBtn);
  return item;
}

function renderNotes(notes) {
  if (notes.length === 0) {
    showEmpty();
    return;
  }
  notesList.replaceChildren(...notes.map(createNoteItem));
}

// ---- GET: load 10 notes ---------------------------------------------------

async function loadNotes() {
  setBusy(true);
  setStatus("Loading notes...", "loading");
  try {
    const { data } = await request(`${API_URL}?_limit=10`);
    const notes = Array.isArray(data) ? data : [];
    renderNotes(notes);
    if (notes.length === 0) {
      setStatus("The server has no notes to show.", "success");
    } else {
      setStatus(`Loaded ${notes.length} notes from the server.`, "success");
    }
  } catch (error) {
    setStatus(friendlyError(error, "loading notes"), "error");
  } finally {
    setBusy(false);
  }
}

loadBtn.addEventListener("click", loadNotes);

// ---- POST: create a note --------------------------------------------------

/** Returns an error message, or "" when the title is valid. */
function validateTitle(title) {
  if (title === "") return "Please enter a title for your note.";
  if (title.length > MAX_TITLE_LENGTH) {
    return `The title is too long (${title.length} characters). Use ${MAX_TITLE_LENGTH} or fewer.`;
  }
  return "";
}

async function createNote(event) {
  event.preventDefault();

  const titleInput = document.getElementById("title-input");
  const bodyInput = document.getElementById("body-input");
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim(); // the body is optional

  const problem = validateTitle(title);
  if (problem) {
    setStatus(problem, "error");
    titleInput.focus();
    return;
  }

  setBusy(true);
  setStatus("Creating note...", "loading");
  try {
    const { status, data } = await request(API_URL, {
      method: "POST",
      body: JSON.stringify({ title, body, userId: 1 }),
    });
    removeEmptyMessage();
    notesList.prepend(createNoteItem(data));
    setStatus(`Note created (status ${status}, id ${data.id}).`, "success");
    event.target.reset(); // clear the form
  } catch (error) {
    setStatus(friendlyError(error, "creating the note"), "error");
  } finally {
    setBusy(false);
  }
}

document.getElementById("note-form").addEventListener("submit", createNote);

// ---- DELETE: remove a note ------------------------------------------------

/*
 * JSONPlaceholder is a fake API: it accepts writes and answers as if they
 * worked (201 for POST, 200 for DELETE) but never stores anything. A note we
 * "created" gets id 101, and a later GET /posts/101 would return 404.
 *
 * Our approach: treat the server's success response as the truth and update
 * the page to match. The page is the only place the new notes live, so a
 * successful DELETE removes the <li> from the DOM. We do not re-fetch the list
 * afterwards, because that would make freshly created notes vanish and
 * "deleted" notes reappear. With the real QuickNotes API, a re-fetch (or an
 * optimistic update that is rolled back on failure) would be the right choice.
 */
async function deleteNote(id, item) {
  setBusy(true);
  setStatus(`Deleting note ${id}...`, "loading");
  try {
    const { status } = await request(`${API_URL}/${id}`, { method: "DELETE" });
    item.remove();
    if (notesList.children.length === 0) showEmpty();
    setStatus(`Note ${id} deleted (status ${status}).`, "success");
  } catch (error) {
    setStatus(friendlyError(error, "deleting the note"), "error");
  } finally {
    setBusy(false);
  }
}