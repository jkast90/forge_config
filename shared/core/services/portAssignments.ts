import { BaseService } from './base';
import type { PortAssignment, SetPortAssignmentRequest } from '../types';

export class PortAssignmentService extends BaseService {
  async list(deviceId: number): Promise<PortAssignment[]> {
    return this.get<PortAssignment[]>(`/devices/${encodeURIComponent(deviceId)}/port-assignments`);
  }

  async set(deviceId: number, req: SetPortAssignmentRequest): Promise<PortAssignment> {
    return this.put<PortAssignment>(
      `/devices/${encodeURIComponent(deviceId)}/port-assignments/${encodeURIComponent(req.port_name)}`,
      req
    );
  }

  async bulkSet(deviceId: number, assignments: SetPortAssignmentRequest[]): Promise<PortAssignment[]> {
    return this.put<PortAssignment[]>(
      `/devices/${encodeURIComponent(deviceId)}/port-assignments`,
      { assignments }
    );
  }

  async remove(deviceId: number, portName: string): Promise<void> {
    return this.delete<void>(
      `/devices/${encodeURIComponent(deviceId)}/port-assignments/${encodeURIComponent(portName)}`
    );
  }
}
