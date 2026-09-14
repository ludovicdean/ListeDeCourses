import { Injectable } from '@angular/core';
import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import { BehaviorSubject, type Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
    {
      auth: {
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
        flowType: 'pkce',
      },
    },
  );

  private readonly sessionSubject = new BehaviorSubject<Session | null>(null);

  readonly session$: Observable<Session | null> = this.sessionSubject.asObservable();

  constructor() {
    void this.initializeAuth();

    this.client.auth.onAuthStateChange((_event, session) => {
      this.sessionSubject.next(session);
    });
  }

  private async initializeAuth(): Promise<void> {
    await this.exchangeCodeFromUrlIfPresent();

    const { data } = await this.client.auth.getSession();
    this.sessionSubject.next(data.session);
  }

  private async exchangeCodeFromUrlIfPresent(): Promise<void> {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    if (!code) {
      return;
    }

    const { data, error } = await this.client.auth.exchangeCodeForSession(code);
    if (error || !data.session) {
      return;
    }

    this.sessionSubject.next(data.session);
    window.history.replaceState({}, '', `${url.origin}${url.pathname}`);
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
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }

    this.sessionSubject.next(data.session);
  }

  async signUp(email: string, password: string): Promise<{ sessionCreated: boolean }> {
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) {
      throw error;
    }

    if (data.session) {
      this.sessionSubject.next(data.session);
    }

    return { sessionCreated: data.session !== null };
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) {
      throw error;
    }

    this.sessionSubject.next(null);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: this.getPasswordRecoveryRedirectUrl(),
    });

    if (error) {
      throw error;
    }
  }

  async updatePassword(password: string): Promise<void> {
    const { data, error } = await this.client.auth.updateUser({ password });
    if (error) {
      throw error;
    }

    if (data.user) {
      const { data: sessionData } = await this.client.auth.getSession();
      this.sessionSubject.next(sessionData.session);
    }
  }

  private getPasswordRecoveryRedirectUrl(): string {
    return `${window.location.origin}/reset-password`;
  }
}