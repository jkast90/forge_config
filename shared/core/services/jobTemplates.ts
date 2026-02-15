import { BaseService } from './base';
import type { JobTemplate, CreateJobTemplateRequest, Job } from '../types';

export class JobTemplateService extends BaseService {
  async list(): Promise<JobTemplate[]> {
    return this.get<JobTemplate[]>('/job-templates');
  }

  async getById(id: string): Promise<JobTemplate> {
    return this.get<JobTemplate>(`/job-templates/${encodeURIComponent(id)}`);
  }

  async create(req: CreateJobTemplateRequest): Promise<JobTemplate> {
    return this.post<JobTemplate>('/job-templates', req);
  }

  async update(id: string, req: CreateJobTemplateRequest): Promise<JobTemplate> {
    return this.put<JobTemplate>(`/job-templates/${encodeURIComponent(id)}`, req);
  }

  async remove(id: string): Promise<void> {
    return this.delete<void>(`/job-templates/${encodeURIComponent(id)}`);
  }

  async run(id: string): Promise<Job[]> {
    return this.post<Job[]>(`/job-templates/${encodeURIComponent(id)}/run`, {});
  }
}
