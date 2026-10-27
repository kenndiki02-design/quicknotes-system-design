# QuickNotes Data Model

## Entities

### users

| Column        | Type              | Key / constraint          |
| ------------- | ----------------- | ------------------------- |
| id            | BIGINT (identity) | **Primary key**           |
| email         | VARCHAR(255)      | NOT NULL, UNIQUE          |
| password_hash | VARCHAR(255)      | NOT NULL                  |
| display_name  | VARCHAR(100)      | NOT NULL                  |
| created_at    | TIMESTAMPTZ       | NOT NULL, default `now()` |

### notes

| Column     | Type              | Key / constraint                       |
| ---------- | ----------------- | -------------------------------------- |
| id         | BIGINT (identity) | **Primary key**                        |
| user_id    | BIGINT            | **Foreign key** → `users.id`, NOT NULL |
| title      | VARCHAR(100)      | NOT NULL                               |
| body       | TEXT              | NOT NULL, default `''`                 |
| created_at | TIMESTAMPTZ       | NOT NULL, default `now()`              |
| updated_at | TIMESTAMPTZ       | NOT NULL, default `now()`              |

### tags

| Column  | Type              | Key / constraint                       |
| ------- | ----------------- | -------------------------------------- |
| id      | BIGINT (identity) | **Primary key**                        |
| user_id | BIGINT            | **Foreign key** → `users.id`, NOT NULL |
| name    | VARCHAR(50)       | NOT NULL, UNIQUE per user              |

### note_tags (join table)

| Column  | Type   | Key / constraint                                       |
| ------- | ------ | ------------------------------------------------------ |
| note_id | BIGINT | **Primary key (part 1)**, **foreign key** → `notes.id` |
| tag_id  | BIGINT | **Primary key (part 2)**, **foreign key** → `tags.id`  |

## Relationships

- **One-to-many: users → notes.** One user owns many notes; each note belongs to exactly one user (`notes.user_id`).
- **One-to-many: users → tags.** Tags are private to each user, so two users can both have a tag called "work" without clashing.
- **Many-to-many: notes ↔ tags.** A note can have several tags and a tag can be on many notes. A relational database cannot store this in two tables directly, so the join table `note_tags` holds one row per (note, tag) pair. Its composite primary key stops the same tag being attached to a note twice.

## CREATE TABLE statements (PostgreSQL)

```sql
CREATE TABLE users (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(100) NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE notes (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(100) NOT NULL CHECK (length(trim(title)) > 0),
  body       TEXT         NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE tags (
  id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name    VARCHAR(50) NOT NULL,
  UNIQUE (user_id, name)
);

CREATE TABLE note_tags (
  note_id BIGINT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id  BIGINT NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);
```

## Example queries

**1. List a user's 20 newest notes (backs `GET /notes`):**

```sql
SELECT id, title, body, created_at
FROM notes
WHERE user_id = 17
ORDER BY created_at DESC
LIMIT 20;
```

**2. Notes with their tags (JOIN across three tables):**

```sql
SELECT n.id, n.title, t.name AS tag
FROM notes n
JOIN note_tags nt ON nt.note_id = n.id
JOIN tags t       ON t.id = nt.tag_id
WHERE n.user_id = 17 AND t.name = 'errands'
ORDER BY n.created_at DESC;
```

**3. How many notes does each tag have for a user?**

```sql
SELECT t.name, COUNT(*) AS note_count
FROM tags t
JOIN note_tags nt ON nt.tag_id = t.id
WHERE t.user_id = 17
GROUP BY t.name
ORDER BY note_count DESC;
```

**4. Delete a note (only if it belongs to the caller):**

```sql
DELETE FROM notes WHERE id = 9041 AND user_id = 17;
```

## Indexes

```sql
CREATE INDEX idx_notes_user_created ON notes (user_id, created_at DESC);
CREATE INDEX idx_note_tags_tag      ON note_tags (tag_id, note_id);
```

- `idx_notes_user_created`: almost every read is "this user's newest notes". Without the index the database would scan all notes (hundreds of millions at our scale); with it, the query jumps to one user's rows already in the right order, so there is no separate sort step.
- `idx_note_tags_tag`: the primary key already covers lookups by note. This index covers the reverse direction, "all notes with this tag", used by the tag filter.

The cost is slightly slower writes and more storage, which is acceptable because QuickNotes reads far more than it writes.

## SQL or NoSQL?

I chose **SQL (PostgreSQL)**. The data is clearly relational: users own notes, and notes and tags form a many-to-many link that benefits from foreign keys, unique constraints and JOINs. Notes must never be lost or half-saved, so ACID transactions matter (for example, creating a note and its tags in one transaction). The schema is small and stable, and the expected load (roughly 90 writes per second at peak) is well within one primary plus read replicas. If a single database ever becomes too big, we can shard by `user_id`, since nearly every query is per user. A document database such as MongoDB would store a note with its tags inline and scale out more easily, but we would give up joins and enforced relationships that we need today.
