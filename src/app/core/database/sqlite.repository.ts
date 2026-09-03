import { Injectable, inject } from '@angular/core';

import {
  SqliteDatabaseService,
  type BindableValue,
  type SqliteExecOptions,
  type SqliteRow,
} from './sqlite-database.service';

export interface RepositoryOptions<T extends SqliteRow> {
  table: string;
  columns: string[];
  mapRow?: (row: SqliteRow) => T;
}

@Injectable({ providedIn: 'root' })
export class SqliteRepository {
  private readonly db = inject(SqliteDatabaseService);

  async query<T extends SqliteRow>(sql: string, bind?: unknown[]): Promise<T[]> {
    const { rows } = await this.db.exec<T>({ sql, bind: bind as BindableValue[] | undefined });
    return rows;
  }

  async get<T extends SqliteRow>(sql: string, bind?: unknown[]): Promise<T | undefined> {
    const rows = await this.query<T>(sql, bind);
    return rows[0];
  }

  async insert<T extends SqliteRow>(table: string, record: Omit<T, 'id'>): Promise<number> {
    const columns = Object.keys(record);
    const values = Object.values(record);
    const placeholders = columns.map(() => '?').join(', ');

    const { rows } = await this.db.exec<{ id: number }>({
      sql: `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) RETURNING id;`,
      bind: values as BindableValue[],
    });

    const id = rows[0]?.['id'];
    if (typeof id !== 'number') {
      throw new Error(`Failed to insert into ${table}`);
    }

    this.db.notifyChange(table);
    return id;
  }

  async update<T extends SqliteRow>(table: string, id: number, changes: Partial<T>): Promise<void> {
    const entries = Object.entries(changes).filter(([, value]) => value !== undefined);
    if (entries.length === 0) {
      return;
    }

    const columns = entries.map(([column]) => `${column} = ?`).join(', ');
    const values = entries.map(([, value]) => value);

    await this.db.exec({
      sql: `UPDATE ${table} SET ${columns} WHERE id = ?;`,
      bind: [...values, id] as BindableValue[],
    });

    this.db.notifyChange(table);
  }

  async delete(table: string, id: number): Promise<void> {
    await this.db.exec({
      sql: `DELETE FROM ${table} WHERE id = ?;`,
      bind: [id],
    });

    this.db.notifyChange(table);
  }

  async exec(options: SqliteExecOptions): Promise<void> {
    await this.db.exec(options);
  }

  async transaction(steps: () => Promise<unknown>): Promise<void> {
    await this.db.transaction(steps);
  }

  notifyChange(table: string): void {
    this.db.notifyChange(table);
  }
}
