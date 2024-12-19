// mqtt v4.3.7 - MQTT client for secure BMS communication
import * as mqtt from 'mqtt';
// rxjs v7.8.0 - Reactive streams for sensor data
import { Observable, Subject, from } from 'rxjs';
import { retry, timeout, catchError, filter, map, bufferTime } from 'rxjs/operators';

import {
  IBMSService,
  IBMSConfig,
  IBMSSensorData,
  BMSConnectionError,
  BMSProtocol,
  BMSSensorStatus,
  IBMSQueryOptions,
  IBMSSubscriptionOptions
} from './interfaces/bms.interface';
import { logger } from '../../common/utils/logger.util';

/**
 * Enhanced BMS service implementation for secure occupancy monitoring
 */
export class BMSService implements IBMSService {
  private client: mqtt.Client | null = null;
  private sensorSubject: Subject<IBMSSensorData>;
  private isConnected: boolean = false;
  private lastSensorUpdate: Map<string, Date>;
  private reconnectAttempts: number = 0;
  private healthCheckInterval: NodeJS.Timer | null = null;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly SENSOR_TIMEOUT = 5000; // 5 seconds

  constructor(private readonly config: IBMSConfig) {
    this.validateConfig(config);
    this.sensorSubject = new Subject<IBMSSensorData>();
    this.lastSensorUpdate = new Map<string, Date>();
  }

  /**
   * Establishes secure MQTT connection to BMS with retry logic
   */
  public async connect(): Promise<void> {
    try {
      const mqttOptions: mqtt.IClientOptions = {
        clientId: this.config.credentials.clientId,
        username: this.config.credentials.username,
        password: this.config.credentials.password,
        protocol: this.config.protocol.toLowerCase(),
        rejectUnauthorized: true,
        reconnectPeriod: this.config.options?.reconnectInterval || 5000,
        connectTimeout: this.config.options?.timeout || 10000,
        keepalive: this.config.options?.keepAlive || 60,
        ...(this.config.credentials.certificatePath && {
          cert: this.config.credentials.certificatePath
        })
      };

      logger.info('Initializing BMS connection', { endpoint: this.config.endpoint });
      
      this.client = mqtt.connect(this.config.endpoint, mqttOptions);
      
      this.setupEventHandlers();
      await this.waitForConnection();
      this.startHealthCheck();
      
      logger.info('BMS connection established successfully');
    } catch (error) {
      logger.error('Failed to connect to BMS', error);
      throw new BMSConnectionError(
        'Failed to establish BMS connection',
        'CONNECTION_ERROR'
      );
    }
  }

  /**
   * Safely terminates MQTT connection with cleanup
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      if (this.client && this.isConnected) {
        await new Promise<void>((resolve, reject) => {
          this.client!.end(false, {}, (error) => {
            if (error) reject(error);
            resolve();
          });
        });
      }

      this.isConnected = false;
      this.sensorSubject.complete();
      this.lastSensorUpdate.clear();
      
      logger.info('BMS connection terminated successfully');
    } catch (error) {
      logger.error('Error during BMS disconnection', error);
      throw new BMSConnectionError(
        'Failed to disconnect from BMS',
        'DISCONNECT_ERROR'
      );
    }
  }

  /**
   * Retrieves and validates current sensor readings
   */
  public async getSensorData(
    sensorIds: string[],
    options?: IBMSQueryOptions
  ): Promise<IBMSSensorData[]> {
    try {
      this.validateConnection();
      this.validateSensorIds(sensorIds);

      const promises = sensorIds.map(async (sensorId) => {
        const topic = `sensors/${sensorId}/data`;
        return new Promise<IBMSSensorData>((resolve, reject) => {
          this.client!.subscribe(topic, (err) => {
            if (err) reject(new Error(`Failed to subscribe to sensor ${sensorId}`));
          });

          const timeoutId = setTimeout(() => {
            reject(new Error(`Sensor ${sensorId} read timeout`));
          }, this.SENSOR_TIMEOUT);

          this.client!.once('message', (receivedTopic, message) => {
            if (receivedTopic === topic) {
              clearTimeout(timeoutId);
              const data = this.parseSensorData(message, sensorId);
              resolve(data);
            }
          });
        });
      });

      const results = await Promise.all(promises);
      return this.filterAndValidateResults(results, options);
    } catch (error) {
      logger.error('Error retrieving sensor data', error);
      throw new BMSConnectionError(
        'Failed to retrieve sensor data',
        'SENSOR_READ_ERROR'
      );
    }
  }

  /**
   * Sets up real-time subscription for sensor updates with backpressure handling
   */
  public subscribeSensorUpdates(
    sensorIds: string[],
    options?: IBMSSubscriptionOptions
  ): Observable<IBMSSensorData> {
    this.validateConnection();
    this.validateSensorIds(sensorIds);

    const topics = sensorIds.map(id => `sensors/${id}/data`);
    
    topics.forEach(topic => {
      this.client!.subscribe(topic, (err) => {
        if (err) {
          logger.error('Failed to subscribe to topic', { topic, error: err });
        }
      });
    });

    return this.sensorSubject.pipe(
      filter(data => sensorIds.includes(data.sensorId)),
      bufferTime(options?.throttleMs || 1000),
      map(updates => updates[updates.length - 1]), // Latest update only
      retry({
        count: 3,
        delay: 1000
      }),
      catchError(error => {
        logger.error('Error in sensor subscription', error);
        throw error;
      })
    );
  }

  private validateConfig(config: IBMSConfig): void {
    if (!config.endpoint || !config.protocol || !config.credentials) {
      throw new Error('Invalid BMS configuration');
    }
  }

  private validateConnection(): void {
    if (!this.isConnected || !this.client) {
      throw new BMSConnectionError(
        'BMS connection not established',
        'NOT_CONNECTED'
      );
    }
  }

  private validateSensorIds(sensorIds: string[]): void {
    if (!Array.isArray(sensorIds) || sensorIds.length === 0) {
      throw new Error('Invalid sensor IDs provided');
    }
  }

  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info('BMS connection established');
    });

    this.client.on('message', (topic, message) => {
      try {
        const sensorId = this.extractSensorId(topic);
        const data = this.parseSensorData(message, sensorId);
        this.lastSensorUpdate.set(sensorId, new Date());
        this.sensorSubject.next(data);
      } catch (error) {
        logger.error('Error processing sensor message', error);
      }
    });

    this.client.on('error', (error) => {
      logger.error('BMS connection error', error);
      this.handleConnectionError();
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.info('BMS connection closed');
    });
  }

  private async waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.config.options?.timeout || 10000);

      this.client!.once('connect', () => {
        clearTimeout(timeoutId);
        resolve();
      });
    });
  }

  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      if (this.client && this.isConnected) {
        this.client.ping();
        this.checkSensorHealth();
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  private handleConnectionError(): void {
    this.reconnectAttempts++;
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      logger.error('Max reconnection attempts reached');
      this.disconnect();
    }
  }

  private extractSensorId(topic: string): string {
    const match = topic.match(/sensors\/(.+)\/data/);
    return match ? match[1] : '';
  }

  private parseSensorData(message: Buffer, sensorId: string): IBMSSensorData {
    try {
      const data = JSON.parse(message.toString());
      return {
        sensorId,
        spaceId: data.spaceId,
        occupancyCount: data.occupancyCount,
        timestamp: new Date(data.timestamp),
        status: data.status || BMSSensorStatus.ACTIVE,
        metadata: {
          accuracy: data.accuracy || 100,
          batteryLevel: data.batteryLevel || 100,
          firmwareVersion: data.firmwareVersion || '1.0.0'
        }
      };
    } catch (error) {
      logger.error('Error parsing sensor data', error);
      throw new Error('Invalid sensor data format');
    }
  }

  private filterAndValidateResults(
    results: IBMSSensorData[],
    options?: IBMSQueryOptions
  ): IBMSSensorData[] {
    return results.filter(data => {
      if (options?.status && data.status !== options.status) {
        return false;
      }
      if (options?.startTime && data.timestamp < options.startTime) {
        return false;
      }
      if (options?.endTime && data.timestamp > options.endTime) {
        return false;
      }
      return true;
    });
  }

  private checkSensorHealth(): void {
    const now = new Date();
    this.lastSensorUpdate.forEach((lastUpdate, sensorId) => {
      const timeDiff = now.getTime() - lastUpdate.getTime();
      if (timeDiff > this.HEALTH_CHECK_INTERVAL * 2) {
        logger.warn('Sensor not reporting', { sensorId, lastUpdate });
      }
    });
  }
}