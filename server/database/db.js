import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = path.join(__dirname, 'auth.db');
const INIT_SQL_PATH = path.join(__dirname, 'init.sql');
const JSON_DB_PATH = path.join(__dirname, 'auth.json');

// We'll try to use better-sqlite3 if available, otherwise fall back to a tiny JSON store
let db = null;
let usingSqlite = false;

// Initialize database with schema or create JSON fallback
const initializeDatabase = async () => {
  try {
    // Dynamic import so missing native module won't crash startup
    const mod = await import('better-sqlite3').catch(() => null);
    if (mod && mod.default) {
      const Database = mod.default;
      db = new Database(DB_PATH);
      const initSQL = fs.readFileSync(INIT_SQL_PATH, 'utf8');
      db.exec(initSQL);
      usingSqlite = true;
      console.log('Connected to SQLite database (better-sqlite3)');
      return;
    }
  } catch (error) {
    console.warn('better-sqlite3 import failed, will use JSON fallback:', error.message);
  }

  // Fallback: ensure JSON file exists
  try {
    if (!fs.existsSync(JSON_DB_PATH)) {
      fs.writeFileSync(JSON_DB_PATH, JSON.stringify({ users: [] }, null, 2));
    }
    usingSqlite = false;
    console.log('Using JSON fallback for user database at', JSON_DB_PATH);
  } catch (error) {
    console.error('Error initializing JSON fallback DB:', error.message);
    throw error;
  }
};

// User database operations
const userDb = {
  // Check if any users exist
  hasUsers: () => {
    if (usingSqlite) {
      try {
        const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
        return row.count > 0;
      } catch (err) {
        throw err;
      }
    }
    // JSON fallback
    const data = JSON.parse(fs.readFileSync(JSON_DB_PATH, 'utf8'));
    return Array.isArray(data.users) && data.users.length > 0;
  },

  // Create a new user
  createUser: (username, passwordHash) => {
    if (usingSqlite) {
      try {
        const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
        const result = stmt.run(username, passwordHash);
        return { id: result.lastInsertRowid, username };
      } catch (err) {
        throw err;
      }
    }
    // JSON fallback
    const data = JSON.parse(fs.readFileSync(JSON_DB_PATH, 'utf8'));
    const id = data.users.reduce((max, u) => Math.max(max, u.id || 0), 0) + 1;
    const user = { id, username, password_hash: passwordHash, created_at: new Date().toISOString(), last_login: null, is_active: 1 };
    data.users.push(user);
    fs.writeFileSync(JSON_DB_PATH, JSON.stringify(data, null, 2));
    return { id: user.id, username };
  },

  // Get user by username
  getUserByUsername: (username) => {
    if (usingSqlite) {
      try {
        const row = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
        return row;
      } catch (err) {
        throw err;
      }
    }
    const data = JSON.parse(fs.readFileSync(JSON_DB_PATH, 'utf8'));
    return data.users.find(u => u.username === username && u.is_active === 1) || null;
  },

  // Update last login time
  updateLastLogin: (userId) => {
    if (usingSqlite) {
      try {
        db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
        return;
      } catch (err) {
        throw err;
      }
    }
    const data = JSON.parse(fs.readFileSync(JSON_DB_PATH, 'utf8'));
    const user = data.users.find(u => u.id === userId);
    if (user) {
      user.last_login = new Date().toISOString();
      fs.writeFileSync(JSON_DB_PATH, JSON.stringify(data, null, 2));
    }
  },

  // Get user by ID
  getUserById: (userId) => {
    if (usingSqlite) {
      try {
        const row = db.prepare('SELECT id, username, created_at, last_login FROM users WHERE id = ? AND is_active = 1').get(userId);
        return row;
      } catch (err) {
        throw err;
      }
    }
    const data = JSON.parse(fs.readFileSync(JSON_DB_PATH, 'utf8'));
    const user = data.users.find(u => u.id === userId && u.is_active === 1);
    if (!user) return null;
    return { id: user.id, username: user.username, created_at: user.created_at, last_login: user.last_login };
  }
};

export {
  db,
  initializeDatabase,
  userDb
};