import { BaseService } from './base';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  username: string;
}

export class AuthService extends BaseService {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    return this.post<LoginResponse>('/auth/login', credentials);
  }
}
