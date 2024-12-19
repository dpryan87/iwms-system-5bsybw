// rxjs version 7.8.0
import { Observable } from 'rxjs';

/**
 * Supported BMS communication protocols
 */
export enum BMSProtocol {
  MQTT = 'MQTT',
  MQTT_WS = 'MQTT_WS',
  MQTT_WSS = 'MQTT_WSS'
}

/**
 * Sensor operational status
 */
export enum BMSSensorStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ERROR = 'ERROR'
}

/**
 * Error class for BMS connection failures
 */
export class BMSConnectionError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'BMSConnectionError';
  }
}

/**
 * Interface for BMS query options
 */
export interface IBMSQueryOptions {
  /**
   * Maximum number of records to return
   */
  limit?: number;
  
  /**
   * Time range start for historical data
   */
  startTime?: Date;
  
  /**
   * Time range end for historical data
   */
  endTime?: Date;
  
  /**
   * Filter by sensor status
   */
  status?: BMSSensorStatus;
}

/**
 * Interface for real-time subscription options
 */
export interface IBMSSubscriptionOptions {
  /**
   * Throttle update frequency in milliseconds
   */
  throttleMs?: number;
  
  /**
   * Buffer size for backpressure handling
   */
  bufferSize?: number;
  
  /**
   * Automatic reconnection on connection loss
   */
  autoReconnect?: boolean;
}

/**
 * Interface for BMS connection credentials
 */
export interface IBMSCredentials {
  /**
   * BMS system username
   */
  username: string;
  
  /**
   * BMS system password
   */
  password: string;
  
  /**
   * Unique client identifier
   */
  clientId: string;
  
  /**
   * Path to SSL/TLS certificate for secure connections
   */
  certificatePath?: string;
}

/**
 * Interface for advanced BMS connection options
 */
export interface IBMSConnectionOptions {
  /**
   * Reconnection interval in milliseconds
   */
  reconnectInterval?: number;
  
  /**
   * Maximum connection retry attempts
   */
  maxRetries?: number;
  
  /**
   * Connection timeout in milliseconds
   */
  timeout?: number;
  
  /**
   * Keep-alive interval in seconds
   */
  keepAlive?: number;
}

/**
 * Interface for BMS configuration settings
 */
export interface IBMSConfig {
  /**
   * BMS server endpoint URL
   */
  endpoint: string;
  
  /**
   * Communication protocol
   */
  protocol: BMSProtocol;
  
  /**
   * Authentication credentials
   */
  credentials: IBMSCredentials;
  
  /**
   * Advanced connection options
   */
  options?: IBMSConnectionOptions;
}

/**
 * Interface for sensor metadata
 */
export interface IBMSSensorMetadata {
  /**
   * Sensor accuracy percentage
   */
  accuracy: number;
  
  /**
   * Battery level percentage
   */
  batteryLevel: number;
  
  /**
   * Sensor firmware version
   */
  firmwareVersion: string;
}

/**
 * Interface for occupancy sensor data
 */
export interface IBMSSensorData {
  /**
   * Unique sensor identifier
   */
  sensorId: string;
  
  /**
   * Associated space identifier
   */
  spaceId: string;
  
  /**
   * Current occupancy count
   */
  occupancyCount: number;
  
  /**
   * Timestamp of the sensor reading
   */
  timestamp: Date;
  
  /**
   * Current sensor operational status
   */
  status: BMSSensorStatus;
  
  /**
   * Additional sensor metadata
   */
  metadata: IBMSSensorMetadata;
}

/**
 * Core interface for BMS service implementation
 */
export interface IBMSService {
  /**
   * Establishes connection to the BMS system
   * @param config - BMS connection configuration
   * @throws {BMSConnectionError} When connection fails
   */
  connect(config: IBMSConfig): Promise<void>;
  
  /**
   * Gracefully terminates the BMS connection
   */
  disconnect(): Promise<void>;
  
  /**
   * Retrieves sensor data for specified sensors
   * @param sensorIds - Array of sensor identifiers
   * @param options - Query options for data retrieval
   * @returns Array of sensor readings
   */
  getSensorData(
    sensorIds: string[],
    options?: IBMSQueryOptions
  ): Promise<IBMSSensorData[]>;
  
  /**
   * Sets up real-time subscription for sensor updates
   * @param sensorIds - Array of sensor identifiers
   * @param options - Subscription options for real-time updates
   * @returns Observable stream of sensor data updates
   */
  subscribeSensorUpdates(
    sensorIds: string[],
    options?: IBMSSubscriptionOptions
  ): Observable<IBMSSensorData>;
}