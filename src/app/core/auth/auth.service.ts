import { Injectable, NgZone, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../supabase/supabase.service';
import { AppUser } from '../../shared/models';
import { Session } from '@supabase/supabase-js';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly session = signal<Session | null>(null);
  readonly profile = signal<AppUser | null>(null);
  readonly loading = signal(true);

  readonly isAuthed = computed(() => !!this.session());
  readonly isDm = computed(() => this.profile()?.role === 'dm');
  readonly userId = computed(() => this.session()?.user?.id ?? null);

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private ngZone: NgZone,
  ) {
    this.init();
  }

  private async init() {
    const { data: { session } } = await this.supabaseService.supabase.auth.getSession();
    if (session) {
      this.session.set(session);
      await this.loadProfile(session.user.id);
    }
    this.loading.set(false);

    this.supabaseService.supabase.auth.onAuthStateChange((_event, session) => {
      this.ngZone.run(async () => {
        this.session.set(session);
        if (session) {
          await this.loadProfile(session.user.id);
        } else {
          this.profile.set(null);
        }
      });
    });
  }

  private async loadProfile(userId: string) {
    const { data } = await this.supabaseService.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) {
      this.profile.set(data as AppUser);
    }
  }

  async login(email: string, password: string): Promise<string | null> {
    const { error } = await this.supabaseService.supabase.auth.signInWithPassword({
      email,
      password,
    });
    return error?.message ?? null;
  }

  async register(
    email: string,
    password: string,
    displayName: string,
    characterName: string,
  ): Promise<string | null> {
    const { error } = await this.supabaseService.supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          character_name: characterName,
        },
      },
    });
    return error?.message ?? null;
  }

  async logout() {
    await this.supabaseService.supabase.auth.signOut();
    this.session.set(null);
    this.profile.set(null);
    this.router.navigate(['/login']);
  }
}
