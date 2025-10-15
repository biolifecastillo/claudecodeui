import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Simple JSON file-based store for development/testing
class JsonFileStore {
  constructor(filename) {
    this.filepath = path.join(__dirname, filename);
    this.data = { users: [] };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filepath)) {
        const content = fs.readFileSync(this.filepath, 'utf8');
        this.data = JSON.parse(content);
      }
    } catch (error) {
      console.warn('Could not load JSON store:', error.message);
    }
  }

  save() {
    try {
      fs.writeFileSync(this.filepath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('Could not save JSON store:', error.message);
    }
  }

  getUserById(id) {
    return this.data.users.find(u => u.id === id) || null;
  }

  getUserByUsername(username) {
    return this.data.users.find(u => u.username === username) || null;
  }

  createUser(username, hashedPassword) {
    const id = Date.now();
    const user = { id, username, password: hashedPassword };
    this.data.users.push(user);
    this.save();
    return user;
  }
}

// Export compatible interface
export const userDb = new JsonFileStore('users.json');

export async function initializeDatabase() {
  console.log('Using JSON file fallback database');
  return true;
}