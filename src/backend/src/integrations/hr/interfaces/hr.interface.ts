/**
 * @fileoverview HR System Integration Interfaces
 * Defines comprehensive TypeScript interfaces for HR system integration including
 * employee data synchronization, department information, and organizational hierarchy.
 * 
 * @version 1.0.0
 * @license MIT
 */

import { IBaseService } from '../../../common/interfaces/service.interface';

/**
 * Comprehensive employee data structure with GDPR-compliant fields
 * Represents core employee information synchronized from HR systems
 */
export interface IEmployee {
  /** Unique internal identifier */
  id: string;
  
  /** HR system employee identifier */
  employeeId: string;
  
  /** Employee first name */
  firstName: string;
  
  /** Employee last name */
  lastName: string;
  
  /** Corporate email address */
  email: string;
  
  /** Associated department identifier */
  departmentId: string;
  
  /** Employee job title */
  title: string;
  
  /** Primary work location */
  location: string;
  
  /** Assigned workspace identifier */
  workspaceId: string;
  
  /** Contact phone number */
  phoneNumber: string;
  
  /** Employment start date */
  startDate: Date;
  
  /** Optional employment end date */
  endDate?: Date;
  
  /** Active employment status */
  isActive: boolean;
  
  /** System roles and permissions */
  roles: string[];
  
  /** Extensible attributes for additional HR data */
  customAttributes: Record<string, any>;
  
  /** Last synchronization timestamp */
  lastSyncTimestamp: Date;
}

/**
 * Enhanced department information structure with hierarchy support
 * Represents organizational structure and reporting relationships
 */
export interface IDepartment {
  /** Unique department identifier */
  id: string;
  
  /** Department display name */
  name: string;
  
  /** Department business code */
  code: string;
  
  /** Optional parent department for hierarchy */
  parentDepartmentId?: string;
  
  /** Department manager employee identifier */
  managerId: string;
  
  /** Current department headcount */
  headcount: number;
  
  /** Department active status */
  isActive: boolean;
  
  /** Child department identifiers for hierarchy */
  childDepartmentIds: string[];
  
  /** Associated cost center code */
  costCenter: string;
  
  /** Department physical location */
  location: string;
  
  /** Additional department metadata */
  metadata: Record<string, any>;
  
  /** Last update timestamp */
  lastUpdateTimestamp: Date;
}

/**
 * Configurable options for employee data synchronization
 * Controls sync behavior and error handling
 */
export interface ISyncOptions {
  /** Start date for incremental sync */
  fromDate: Date;
  
  /** Full sync flag overrides incremental */
  fullSync: boolean;
  
  /** Optional department filter */
  departmentIds?: string[];
  
  /** Include inactive records flag */
  includeInactive: boolean;
  
  /** Batch size for processing */
  batchSize: number;
  
  /** Number of retry attempts */
  retryAttempts: number;
  
  /** Operation timeout in seconds */
  timeoutSeconds: number;
  
  /** Enable data validation */
  validateData: boolean;
  
  /** Sync strategy selection */
  syncStrategy: string;
  
  /** Additional sync options */
  customOptions: Record<string, any>;
}

/**
 * Extended HR service interface with comprehensive operations
 * Implements base service contract with HR-specific functionality
 */
export interface IHRService extends IBaseService {
  /**
   * Synchronizes employee data with configurable options and error handling
   * 
   * @param options - Sync configuration options
   * @returns Promise resolving to sync operation result
   */
  syncEmployeeData(options: ISyncOptions): Promise<{
    success: boolean;
    errors: Error[];
    syncedCount: number;
  }>;

  /**
   * Retrieves detailed department information with hierarchy
   * 
   * @param departmentId - Target department identifier
   * @returns Promise resolving to department information
   */
  getDepartmentInfo(departmentId: string): Promise<IDepartment>;

  /**
   * Retrieves comprehensive employee information
   * 
   * @param employeeId - Target employee identifier
   * @returns Promise resolving to employee information
   */
  getEmployeeDetails(employeeId: string): Promise<IEmployee>;

  /**
   * Validates employee data against business rules
   * 
   * @param employee - Employee data to validate
   * @returns Promise resolving to validation result
   */
  validateEmployeeData(employee: IEmployee): Promise<{
    valid: boolean;
    errors: string[];
  }>;
}