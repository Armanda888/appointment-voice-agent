const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const logger = require('../utils/logger');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../data/appointments.db');

class AppointmentModel {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          logger.error('Error opening database:', err);
          reject(err);
        } else {
          logger.info('Connected to SQLite database');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  async createTables() {
    const createAppointmentsTableSQL = `
      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_user_id TEXT NOT NULL,
        telegram_chat_id TEXT NOT NULL,
        institute_name TEXT NOT NULL,
        institute_phone TEXT NOT NULL,
        service TEXT NOT NULL,
        preferred_date TEXT,
        preferred_time TEXT,
        customer_name TEXT,
        status TEXT DEFAULT 'pending',
        call_id TEXT,
        call_transcript TEXT,
        confirmed_date TEXT,
        confirmed_time TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createInstitutesTableSQL = `
      CREATE TABLE IF NOT EXISTS institutes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        phone TEXT NOT NULL,
        address TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    try {
      await this.runSQL(createAppointmentsTableSQL);
      await this.runSQL(createInstitutesTableSQL);
      logger.info('Appointments and institutes tables ready');
    } catch (err) {
      logger.error('Error creating tables:', err);
      throw err;
    }
  }

  runSQL(sql) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, (err) => {
        if (err) {
          logger.error('Error creating table:', err);
          reject(err);
        } else {
          logger.info('Appointments table ready');
          resolve();
        }
      });
    });
  }

  async create(appointment) {
    const {
      telegram_user_id,
      telegram_chat_id,
      institute_name,
      institute_phone,
      service,
      preferred_date,
      preferred_time,
      customer_name
    } = appointment;

    const sql = `
      INSERT INTO appointments 
      (telegram_user_id, telegram_chat_id, institute_name, institute_phone, service, preferred_date, preferred_time, customer_name, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [
        telegram_user_id,
        telegram_chat_id,
        institute_name,
        institute_phone,
        service,
        preferred_date,
        preferred_time,
        customer_name
      ], function(err) {
        if (err) {
          logger.error('Error creating appointment:', err);
          reject(err);
        } else {
          logger.info(`Created appointment with ID: ${this.lastID}`);
          resolve(this.lastID);
        }
      });
    });
  }

  async updateStatus(id, status, updates = {}) {
    const allowedStatuses = ['pending', 'calling', 'confirmed', 'failed', 'cancelled'];
    if (!allowedStatuses.includes(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    const updateFields = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const values = [status];

    if (updates.call_id) {
      updateFields.push('call_id = ?');
      values.push(updates.call_id);
    }
    if (updates.call_transcript) {
      updateFields.push('call_transcript = ?');
      values.push(updates.call_transcript);
    }
    if (updates.confirmed_date) {
      updateFields.push('confirmed_date = ?');
      values.push(updates.confirmed_date);
    }
    if (updates.confirmed_time) {
      updateFields.push('confirmed_time = ?');
      values.push(updates.confirmed_time);
    }
    if (updates.notes) {
      updateFields.push('notes = ?');
      values.push(updates.notes);
    }

    values.push(id);

    const sql = `UPDATE appointments SET ${updateFields.join(', ')} WHERE id = ?`;

    return new Promise((resolve, reject) => {
      this.db.run(sql, values, function(err) {
        if (err) {
          logger.error('Error updating appointment:', err);
          reject(err);
        } else {
          logger.info(`Updated appointment ${id} to status: ${status}`);
          resolve(this.changes);
        }
      });
    });
  }

  async getById(id) {
    const sql = 'SELECT * FROM appointments WHERE id = ?';
    
    return new Promise((resolve, reject) => {
      this.db.get(sql, [id], (err, row) => {
        if (err) {
          logger.error('Error getting appointment:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async getByCallId(callId) {
    const sql = 'SELECT * FROM appointments WHERE call_id = ?';
    
    return new Promise((resolve, reject) => {
      this.db.get(sql, [callId], (err, row) => {
        if (err) {
          logger.error('Error getting appointment by call ID:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async getByUserId(telegramUserId, limit = 10) {
    const sql = `
      SELECT * FROM appointments 
      WHERE telegram_user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `;
    
    return new Promise((resolve, reject) => {
      this.db.all(sql, [telegramUserId, limit], (err, rows) => {
        if (err) {
          logger.error('Error getting user appointments:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getPendingAppointments() {
    const sql = `
      SELECT * FROM appointments 
      WHERE status = 'pending' 
      ORDER BY created_at ASC
    `;
    
    return new Promise((resolve, reject) => {
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          logger.error('Error getting pending appointments:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Institute management methods
  async addInstitute(institute) {
    const { name, phone, address, notes } = institute;
    
    const sql = `
      INSERT INTO institutes (name, phone, address, notes)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        phone = excluded.phone,
        address = excluded.address,
        notes = excluded.notes,
        updated_at = CURRENT_TIMESTAMP
    `;

    return new Promise((resolve, reject) => {
      this.db.run(sql, [name, phone, address, notes], function(err) {
        if (err) {
          logger.error('Error adding institute:', err);
          reject(err);
        } else {
          logger.info(`Added/updated institute: ${name}`);
          resolve(this.lastID);
        }
      });
    });
  }

  async getInstituteByName(name) {
    const sql = 'SELECT * FROM institutes WHERE name = ? COLLATE NOCASE';
    
    return new Promise((resolve, reject) => {
      this.db.get(sql, [name], (err, row) => {
        if (err) {
          logger.error('Error getting institute:', err);
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async searchInstitutes(searchTerm) {
    const sql = `
      SELECT * FROM institutes 
      WHERE name LIKE ? COLLATE NOCASE
      ORDER BY name
      LIMIT 10
    `;
    
    return new Promise((resolve, reject) => {
      this.db.all(sql, [`%${searchTerm}%`], (err, rows) => {
        if (err) {
          logger.error('Error searching institutes:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getAllInstitutes() {
    const sql = 'SELECT * FROM institutes ORDER BY name';
    
    return new Promise((resolve, reject) => {
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          logger.error('Error getting all institutes:', err);
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async deleteInstitute(name) {
    const sql = 'DELETE FROM institutes WHERE name = ? COLLATE NOCASE';
    
    return new Promise((resolve, reject) => {
      this.db.run(sql, [name], function(err) {
        if (err) {
          logger.error('Error deleting institute:', err);
          reject(err);
        } else {
          logger.info(`Deleted institute: ${name}`);
          resolve(this.changes);
        }
      });
    });
  }

  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            logger.error('Error closing database:', err);
            reject(err);
          } else {
            logger.info('Database connection closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = new AppointmentModel();
