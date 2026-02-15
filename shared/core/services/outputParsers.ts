import { BaseService } from './base';
import type { OutputParser, OutputParserFormData } from '../types';

export class OutputParserService extends BaseService {
  async list(): Promise<OutputParser[]> {
    return this.get<OutputParser[]>('/output-parsers');
  }

  async getById(id: number): Promise<OutputParser> {
    return this.get<OutputParser>(`/output-parsers/${id}`);
  }

  async create(data: OutputParserFormData): Promise<OutputParser> {
    return this.post<OutputParser>('/output-parsers', data);
  }

  async update(id: number, data: OutputParserFormData): Promise<OutputParser> {
    return this.put<OutputParser>(`/output-parsers/${id}`, data);
  }

  async remove(id: number): Promise<void> {
    return this.delete<void>(`/output-parsers/${id}`);
  }
}
