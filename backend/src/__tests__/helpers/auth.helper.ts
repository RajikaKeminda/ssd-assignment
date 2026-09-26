import jwt from 'jsonwebtoken';
import { UserRole } from '../../models/user.model';

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'test-jwt-secret-key';

export const generateTestToken = (userId: string, role: UserRole): string => {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '1h' });
};

export const generatePatientToken = (userId: string): string => {
  return generateTestToken(userId, UserRole.PATIENT);
};

export const generateStaffToken = (userId: string): string => {
  return generateTestToken(userId, UserRole.PHARMACY_STAFF);
};

export const generateAdminToken = (userId: string): string => {
  return generateTestToken(userId, UserRole.SYSTEM_ADMIN);
};
