const pg = require("pg");
const express = require("express");
const app = express();
const morgan = require("morgan");

const client = new pg.Client(
  process.env.DATABASE_URL || "postgres://localhost/acme_notes_categories_db"
);

app.use(express.json());
app.use(morgan("dev"));

app.delete("/api/notes/:id", async (req, res, next) => {
  try {
    const SQL = `
      DELETE FROM notes
      WHERE id = $1
    `;
    await client.query(SQL, [req.params.id]);
    res.sendStatus(204);
  } catch (ex) {
    next(ex);
  }
});

app.post("/api/notes", async (req, res, next) => {
  try {
    const SQL = `
      INSERT INTO notes(txt, category_id)
      VALUES($1, $2)
      RETURNING *
    `;
    const response = await client.query(SQL, [
      req.body.txt,
      req.body.category_id,
    ]);
    res.status(201).send(response.rows[0]);
  } catch (ex) {
    next(ex);
  }
});

app.put("/api/notes/:id", async (req, res, next) => {
  try {
    const SQL = `
      UPDATE notes
      SET txt = $1, 
      ranking = $2, 
      updated_at = now(), 
      category_id = $3
      WHERE id = $4
      RETURNING *
    `;
    const response = await client.query(SQL, [
      req.body.txt,
      req.body.ranking,
      req.body.category_id,
      req.params.id,
    ]);
    res.send(response.rows[0]);
  } catch (ex) {
    next(ex);
  }
});

app.get("/api/notes", async (req, res, next) => {
  try {
    const SQL = `
      SELECT * 
      FROM notes;
    `;
    const response = await client.query(SQL);
    res.send(response.rows);
  } catch (ex) {
    next(ex);
  }
});

app.get("/api/categories", async (req, res, next) => {
  try {
    const SQL = `
      SELECT * 
      FROM categories;
    `;
    const response = await client.query(SQL);
    res.send(response.rows);
  } catch (ex) {
    next(ex);
  }
});

app.use((err, req, res, next) => {
  res.status(err.status || 500).send({ error: err.message || err });
});

const init = async () => {
  console.log("connecting to database");
  await client.connect();
  console.log("connected to database");
  let SQL = `
    DROP TABLE IF EXISTS notes;
    DROP TABLE IF EXISTS categories;
    CREATE TABLE categories(
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL
    );
    CREATE TABLE notes(
      id SERIAL PRIMARY KEY,
      txt VARCHAR(100) NOT NULL,
      ranking INTEGER NOT NULL DEFAULT 5,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now(),
      category_id INTEGER REFERENCES categories(id) NOT NULL
    );
  `;
  await client.query(SQL);
  console.log("tables created");
  SQL = `
      INSERT INTO categories(name) VALUES('foo category');
      INSERT INTO categories(name) VALUES('bar category');
      INSERT INTO categories(name) VALUES('baz category');
      INSERT INTO notes(txt, category_id) VALUES('foo note 1', ( SELECT id FROM categories WHERE name='foo category'));
      INSERT INTO notes(txt, category_id) VALUES('bar note 1', ( SELECT id FROM categories WHERE name='bar category'));
      INSERT INTO notes(txt, category_id) VALUES('bar note 2', ( SELECT id FROM categories WHERE name='bar category'));
  `;
  await client.query(SQL);
  console.log("data seeded");
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`listening on port ${port}`);
    console.log("curl commands to test application");
    console.log(`curl localhost:${port}/api/notes`);
    console.log(`curl localhost:${port}/api/categories`);
    console.log(`curl -X DELETE localhost:${port}/api/notes/1`);
    console.log(
      `curl -X POST localhost:${port}/api/notes -d '{"txt": "another foo", "category_id": 1}' -H "Content-Type:application/json"`
    );
    console.log(
      `curl -X PUT localhost:${port}/api/notes/1 -d '{"txt": "updated", "category_id": 3, "ranking":7}' -H "Content-Type:application/json"`
    );
  });
};

init();
