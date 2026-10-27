# QuickNotes System Design

QuickNotes is moving from a browser-only app to an online service for 1 million users. This repository has two parts:

1. **A small API client** (HTML, CSS and plain JavaScript) that proves the front end can load, create and delete notes through a REST API. It uses the [JSONPlaceholder](https://jsonplaceholder.typicode.com/) practice API.
2. **Design documents** for the real backend: the REST API, the database model and the system architecture.

## How to run the API client

No build step or install is needed.

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/quicknotes-system-design.git
   cd quicknotes-system-design
   ```
2. Open `index.html` in a browser, or serve the folder locally:
   ```bash
   python3 -m http.server 8000
   ```
   then visit <http://localhost:8000>.
3. Click **Load notes** to fetch 10 notes (GET).
4. Fill in the form and click **Create note** to send a POST. The title is required (max 100 characters); the body is optional.
5. Click **Delete** on any note to send a DELETE.

JSONPlaceholder does not really save changes. Created notes get id 101 and are only kept on the page, and deleted notes will come back the next time you load. The approach is explained in a comment above `deleteNote` in `api.js`.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page structure, form and status area |
| `api.js` | `request()` helper plus GET, POST and DELETE, validation and page states |
| `style.css` | Styling, including separate success and error messages |

## Design documents

- [API design](docs/api-design.md): endpoints, examples and error codes
- [Data model](docs/data-model.md): tables, keys, SQL, indexes and the SQL vs NoSQL decision
- [Architecture](docs/architecture.md): requirements, load estimate, diagram, request flows and trade-offs

## What I learned

- **One `request()` function keeps error handling consistent.** `fetch` only rejects on network failures, so I must check `response.ok` myself and throw for 4xx and 5xx responses.
- **Every request needs four states.** Loading, success, error and empty each need a clear message, and buttons must be disabled while a request runs so users cannot send duplicates.
- **Never trust user text.** Using `textContent` instead of `innerHTML` stops user input from being run as HTML, and validation (title required, 100 characters max) should happen before any request is sent.
- **Estimating load drives design.** Turning 1 million users into about 70 reads and 17 writes per second showed the system is read-heavy, which is why a cache and a read replica make sense.
- **Every design choice is a trade-off.** Caches can be stale, replicas can lag and queues are eventually consistent, so I need to say what I give up as well as what I gain.
