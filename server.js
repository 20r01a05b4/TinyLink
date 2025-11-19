// TinyLink server (Express)
const express = require('express');
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

//postgres pool creation
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const BASE_URL = (process.env.BASE_URL || 'http://localhost:10000').replace(/\/$/, '');
const PORT = process.env.PORT || 10000;
const CODE_REGEX = /^[A-Za-z0-9]{6,8}$/;

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/healthz', (req, res) => {
  res.json({ ok: true, version: '1.0' });
});

//helper to validate url
function isValidUrl(input) {
  try {
    const u = new URL(input);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

// random 6 digit code generator
function genRandomCode(length = 6) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = Buffer.from(require('crypto').randomBytes(length));
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function getUniqueCode() {
  for (let len = 6; len <= 8; len++) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const c = genRandomCode(len);
      const { rowCount } = await pool.query('SELECT 1 FROM links WHERE code=$1', [c]);
      if (rowCount === 0) return c;
    }
  }
  throw new Error('Unable to generate unique code');
}



// Create link
app.post('/api/links', async (req, res) => {
  const { target, code: customCode } = req.body || {};

  if (!target || !isValidUrl(target)) {
    return res.status(400).json({ error: 'Invalid target URL' });
  }

  let code = null;

  try {
    if (customCode) {
      if (!CODE_REGEX.test(customCode)) {
        return res.status(400).json({ error: 'Custom code must match [A-Za-z0-9]{6,8}' });
      }

      const { rowCount } = await pool.query('SELECT 1 FROM links WHERE code=$1', [customCode]);
      if (rowCount > 0) return res.status(409).json({ error: 'Code already exists' });

      code = customCode;
    } else {
      code = await getUniqueCode();
    }

    await pool.query(
      'INSERT INTO links(code, target_url) VALUES($1, $2)',
      [code, target]
    );

    return res.status(201).json({
      code,
      shortUrl: `${BASE_URL}/${code}`,
      target
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// List all links
app.get('/api/links', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT code, target_url AS target, clicks, last_clicked, created_at
       FROM links
       ORDER BY created_at DESC`
    );
    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Stats for one code
app.get('/api/links/:code', async (req, res) => {
  console.log("method triggering");
  const { code } = req.params;
  if (!CODE_REGEX.test(code)) return res.status(400).json({ error: 'Invalid code format' });

  try {
    const { rows } = await pool.query(
      `SELECT code, target_url AS target, clicks, last_clicked, created_at
       FROM links
       WHERE code=$1`,
      [code]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });

    res.json(rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Delete link
app.delete('/api/links/:code', async (req, res) => {
  const { code } = req.params;

  if (!CODE_REGEX.test(code)) return res.status(400).json({ error: 'Invalid code format' });

  try {
    const result = await pool.query('DELETE FROM links WHERE code=$1', [code]);

    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });

    return res.status(204).send();

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});



app.get('/:code', async (req, res) => {
  const { code } = req.params;

  if (!CODE_REGEX.test(code)) return res.status(404).send('Not found');

  try {
    const { rows } = await pool.query(
      `UPDATE links SET clicks = clicks + 1, last_clicked = now()
       WHERE code = $1
       RETURNING target_url`,
      [code]
    );

    if (rows.length === 0) return res.status(404).send('Not found');

    const target = rows[0].target_url;

    return res.redirect(302, target);

  } catch (err) {
    console.error(err);
    return res.status(500).send('Server error');
  }
});

app.listen(PORT, () => console.log(`TinyLink running on port ${PORT}`));
