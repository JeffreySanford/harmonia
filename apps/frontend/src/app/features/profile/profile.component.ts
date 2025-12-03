import { Component, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import * as AuthSelectors from '../../store/auth/auth.selectors';
import { User } from '../../store/auth/auth.state';

/**
 * Profile Component (Placeholder)
 * 
 * User profile settings and account management.
 * 
 * **TODO**:
 * - Implement profile form with ReactiveFormsModule
 * - Add avatar upload
 * - Add password change form
 * - Add email change with verification
 * - Integrate with backend API
 */
@Component({
  selector: 'harmonia-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  standalone: false
})
export class ProfileComponent {
  private store = inject(Store);
  
  user$: Observable<User | null> = this.store.select(AuthSelectors.selectUser);
}
