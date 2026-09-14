import { Injectable } from '@angular/core';
import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import { BehaviorSubject, type Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
  );

  private readonly sessionSubject = new BehaviorSubject<Session | null>(null);

  readonly session$: Observable<Session | null> = this.sessionSubject.asObservable();

  constructor() {
    void this.client.auth.getSession().then(({ data }) => {
      this.sessionSubject.next(data.session);
    });

    this.client.auth.onAuthStateChange((_event, session) => {
      this.sessionSubject.next(session);
    });
  }

  get supabase(): SupabaseClient {
    return this.client;
  }

  get session(): Session | null {
    return this.sessionSubject.value;
  }

  get isAuthenticated(): boolean {
    return this.session !== null;
  }

  get userId(): string {
    const id = this.session?.user?.id;
    if (!id) {
      throw new Error('Utilisateur non connecté');
    }
    return id;
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
  }

  async signUp(email: string, password: string): Promise<void> {
    const { error } = await this.client.auth.signUp({ email, password });
    if (error) {
      throw error;
    }
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) {
      throw error;
    }
  }
}