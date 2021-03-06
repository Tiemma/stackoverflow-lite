import { readFileSync } from 'fs';
import { Pool } from 'pg';
import logger from 'debug';
import Config from '../config';
import { NullError, SQLExecError } from '../errors/error';

export default class Model {
  constructor(table) {
    this.table = table;
    this.pool = Model.initConn();
    if (!table) {
      throw new NullError('Table name must be defined');
    }

    this.pool.on('error', (err) => {
      Model.debug('Unexpected error on idle client', err.message);
      process.exit(-1);
    });
  }

  static debug(message) {
    return logger(`stackoverflow-api-node:models/${__filename.split(/[\\/]/).pop()}`)(message);
  }

  static returnInstance() {
    return new Model();
  }

  execSQL(sql) {
    /**
     * Executes sql statements and runs result in callback function
     */
    return new Promise(((resolve, reject) => {
      this.pool.query(sql)
        .then((res) => {
          Model.debug(`execSQL - Client response after executing SQL: ${JSON.stringify(res.rows[0])}`);
          Model.debug(sql);
          resolve(res);
        })
        .catch(err => setImmediate(() => {
          reject(new SQLExecError(`execSQL - An error occurred: ${err.message}`));
        }));
    }));
  }

  runQueryInPromise(sql, funcName) {
    return new Promise((resolve, reject) => {
      this.execSQL(sql).then(resp => resolve(resp))
        .catch(err => setImmediate(() => {
          reject(new SQLExecError(`${funcName} - An error occurred: ${err}`));
        }));
    });
  }

  bootstrapTables() {
    /**
     * Sets up the tables up in the database
     */
    const tableSQL = readFileSync('sql/tables.sql', 'utf8');
    return this.execSQL(tableSQL);
  }

  static initConn() {
    /**
     * This instantiates the database connection to the db
     */
    const poolSettings = {
      connectionString: Config(process.env.NODE_ENV).DATABASE_URI,
      ssl: JSON.parse(process.env.ENABLE_SSL),
    };
    Model.debug(`Initialised connection to the POSTGRES pool using config: ${JSON.stringify(poolSettings)}`);
    return new Pool(poolSettings);
    // return new Pool({ connectionString: Config(process.env.NODE_ENV).DATABASE_URI });
  }

  static filterBadCharacters(words) {
    return String(words).split('\'').join('`');
  }

  selectAll(fields) {
    Model.debug(`selectAll - Selecting all fields in ${this.table}`);
    const sql = `SELECT ${fields.join(',')} from ${this.table}`;
    return this.runQueryInPromise(sql, 'selectAll');
  }

  countAllWithConstraints(constraints) {
    Model.debug(`countAllWithConstraints - Returning the number of results for a query with constraints: ${JSON.stringify(constraints)}`);
    let sql = `SELECT COUNT(*) from ${this.table}`;
    if (Object.keys(constraints).length) {
      Model.debug('countAllWithConstraints - There are constraints for this query');
      sql += ` WHERE ${Model.parseToSQLFormat(constraints, ' AND ')}`;
    }
    return this.runQueryInPromise(sql, 'countAllWithConstraints');
  }

  selectWithConstraints(fields, constraints) {
    Model.debug(`selectWithConstraints - Selecting fields ${fields} from table ${this.table} with constraints: ${constraints.toString()}`);
    if (!constraints) {
      return this.selectAll(fields);
    }
    const sql = `SELECT ${fields.join(',')} FROM ${this.table} WHERE ${Model.parseToSQLFormat(constraints, ' AND ')}`;
    Model.debug(sql);
    return this.runQueryInPromise(sql, 'selectWithConstraints');
  }

  selectOne(fields, constraints) {
    Model.debug(`selectOne - Selecting fields ${fields} from table ${this.table} with constraints: ${constraints.toString()}`);
    const sql = `SELECT ${fields.join(',')} FROM ${this.table} WHERE ${Model.parseToSQLFormat(constraints, ' AND ')} LIMIT 1`;
    Model.debug(sql);
    return this.runQueryInPromise(sql, 'selectOne');
  }

  delete(constraints) {
    Model.debug(`delete - Deleting fields from table ${this.table} with constraints: ${constraints.toString()}`);
    const sql = `DELETE FROM ${this.table} WHERE ${Model.parseToSQLFormat(constraints, ' AND ')}`;
    Model.debug(sql);
    return this.runQueryInPromise(sql, 'delete');
  }

  insert(constraints, fields) {
    Model.debug(`insert - Inserting into table ${this.table} with constraints ${JSON.stringify(constraints)} and returning fields ${fields}`);
    const sql = `INSERT INTO ${this.table} (${Object.keys(constraints).join(',')}) VALUES(${Object.values(constraints).map(x => `'${Model.filterBadCharacters(x)}'`).join(',')})`;
    Model.debug(sql);
    const self = this;
    return new Promise((resolve, reject) => {
      this.execSQL(sql).then(() => {
        self.selectOne(fields, constraints).then(resp => resolve(resp));
      }).catch(err => setImmediate(() => {
        reject(new SQLExecError(`insert - An error occurred: ${err}`));
      }));
    });
  }

  update(updateFields, constraints, fields) {
    Model.debug(`update - Inserting into table ${this.table} with constraints ${constraints.toString()} and returning fields ${fields}`);
    const sql = `UPDATE ${this.table} SET  ${Model.parseToSQLFormat(updateFields)} WHERE ${Model.parseToSQLFormat(constraints, ',')}`;
    Model.debug(sql);
    const self = this;
    return new Promise((resolve, reject) => {
      this.execSQL(sql).then(() => {
        this.execSQL(sql).then(() => {
          self.selectOne(fields, updateFields).then(resp => resolve(resp));
        }).catch(err => setImmediate(() => {
          reject(new SQLExecError(`update - An error occurred: ${err}`));
        }));
      });
    });
  }

  static handleResponse(resp) {
    console.log(resp.rows);
  }

  static parseToSQLFormat(object, delimiter) {
    return Object.keys(object).map(key => `${key}='${Model.filterBadCharacters(object[key])}'`).join(delimiter);
  }
}

// new Model('users').update({ name: 'Bakare Emmanuel', username: 'Tiemma', password: 'blank' },
// { name: 'Bakare b' }, ['name'], Model.handleResponse);
