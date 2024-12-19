// External imports with versions
import React, { useRef, useEffect, useState } from 'react'; // ^18.0.0
import FullCalendar from '@fullcalendar/react'; // ^6.1.8
import dayGridPlugin from '@fullcalendar/daygrid'; // ^6.1.8
import interactionPlugin from '@fullcalendar/interaction'; // ^6.1.8
import * as CryptoJS from 'crypto-js'; // ^4.1.1

// Internal imports
import { 
  ILease, 
  LeaseStatus, 
  NotificationType,
  NotificationStatus 
} from '../../types/lease.types';
import LeaseService from '../../services/lease.service';

// Security level enum for lease data classification
enum SecurityLevel {
  PUBLIC = 'PUBLIC',
  CONFIDENTIAL = 'CONFIDENTIAL',
  RESTRICTED = 'RESTRICTED'
}

// Financial status enum for lease events
enum FinancialStatus {
  CURRENT = 'CURRENT',
  PENDING = 'PENDING',
  OVERDUE = 'OVERDUE',
  ESCALATION = 'ESCALATION'
}

// Interface for audit metadata
interface AuditMetadata {
  timestamp: Date;
  userId: string;
  action: string;
  details?: string;
}

// Enhanced props interface with security and financial features
interface LeaseCalendarProps {
  leases: ILease[];
  onEventClick: (leaseId: string) => void;
  onDateSelect: (start: Date, end: Date) => void;
  className?: string;
  securityLevel: SecurityLevel;
  financialTracking: boolean;
  auditLogging: boolean;
}

// Enhanced calendar event interface
interface LeaseEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  className: string;
  securityLevel: SecurityLevel;
  financialStatus: FinancialStatus;
  auditInfo: AuditMetadata;
  extendedProps: {
    leaseId: string;
    type: string;
  };
}

// Secure transformation of lease data to calendar events
const transformLeasesToEvents = (
  leases: ILease[],
  securityLevel: SecurityLevel
): LeaseEvent[] => {
  const events: LeaseEvent[] = [];

  leases.forEach(lease => {
    // Validate access permissions
    if (!LeaseService.validateLeaseAccess(lease.id)) {
      return;
    }

    // Create lease period event
    const leaseEvent: LeaseEvent = {
      id: CryptoJS.SHA256(lease.id + 'period').toString(),
      title: `Lease: ${lease.propertyId}`,
      start: lease.startDate,
      end: lease.endDate,
      className: `lease-event lease-status-${lease.status.toLowerCase()}`,
      securityLevel,
      financialStatus: determineFinancialStatus(lease),
      auditInfo: {
        timestamp: new Date(),
        userId: 'current-user',
        action: 'VIEW_LEASE',
      },
      extendedProps: {
        leaseId: lease.id,
        type: 'LEASE_PERIOD'
      }
    };
    events.push(leaseEvent);

    // Add financial tracking events
    if (lease.financials) {
      lease.financials.paymentSchedule.forEach(payment => {
        events.push({
          id: CryptoJS.SHA256(payment.id + 'payment').toString(),
          title: `Payment Due: $${payment.amount}`,
          start: payment.dueDate,
          end: payment.dueDate,
          className: `payment-event payment-status-${payment.status.toLowerCase()}`,
          securityLevel: SecurityLevel.RESTRICTED,
          financialStatus: payment.status === 'OVERDUE' ? 
            FinancialStatus.OVERDUE : FinancialStatus.PENDING,
          auditInfo: {
            timestamp: new Date(),
            userId: 'current-user',
            action: 'VIEW_PAYMENT',
          },
          extendedProps: {
            leaseId: lease.id,
            type: 'PAYMENT'
          }
        });
      });
    }

    // Add renewal notification events
    if (lease.renewal && lease.renewal.deadlineDate) {
      events.push({
        id: CryptoJS.SHA256(lease.id + 'renewal').toString(),
        title: 'Renewal Deadline',
        start: lease.renewal.deadlineDate,
        end: lease.renewal.deadlineDate,
        className: `renewal-event renewal-status-${lease.renewal.status.toLowerCase()}`,
        securityLevel: SecurityLevel.CONFIDENTIAL,
        financialStatus: FinancialStatus.PENDING,
        auditInfo: {
          timestamp: new Date(),
          userId: 'current-user',
          action: 'VIEW_RENEWAL',
        },
        extendedProps: {
          leaseId: lease.id,
          type: 'RENEWAL'
        }
      });
    }
  });

  return events;
};

// Helper function to determine financial status
const determineFinancialStatus = (lease: ILease): FinancialStatus => {
  if (lease.financials.outstandingBalance > 0) {
    return FinancialStatus.OVERDUE;
  }
  if (lease.financials.escalationSchedule.some(e => !e.applied && new Date(e.effectiveDate) <= new Date())) {
    return FinancialStatus.ESCALATION;
  }
  return FinancialStatus.CURRENT;
};

// Main calendar component
const LeaseCalendar: React.FC<LeaseCalendarProps> = ({
  leases,
  onEventClick,
  onDateSelect,
  className = '',
  securityLevel,
  financialTracking,
  auditLogging
}) => {
  const calendarRef = useRef<FullCalendar>(null);
  const [encryptedEvents, setEncryptedEvents] = useState<LeaseEvent[]>([]);

  useEffect(() => {
    // Transform and encrypt lease data
    const events = transformLeasesToEvents(leases, securityLevel);
    const encrypted = events.map(event => ({
      ...event,
      title: LeaseService.encryptLeaseData(event.title),
    }));
    setEncryptedEvents(encrypted);

    // Log audit trail if enabled
    if (auditLogging) {
      LeaseService.generateAuditLog('VIEW_CALENDAR', 'all');
    }
  }, [leases, securityLevel, auditLogging]);

  // Secure event click handler
  const handleEventClick = (info: any) => {
    if (auditLogging) {
      LeaseService.generateAuditLog('CLICK_EVENT', info.event.extendedProps.leaseId);
    }
    onEventClick(info.event.extendedProps.leaseId);
  };

  // Secure date selection handler
  const handleDateSelect = (info: any) => {
    if (auditLogging) {
      LeaseService.generateAuditLog('SELECT_DATE', 'calendar', 
        `${info.start.toISOString()} - ${info.end.toISOString()}`);
    }
    onDateSelect(info.start, info.end);
  };

  return (
    <div className={`lease-calendar-container ${className}`}>
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={encryptedEvents}
        eventClick={handleEventClick}
        select={handleDateSelect}
        selectable={true}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,dayGridWeek'
        }}
        eventClassNames={(arg) => [
          `security-level-${arg.event.extendedProps.securityLevel.toLowerCase()}`,
          `financial-status-${arg.event.extendedProps.financialStatus.toLowerCase()}`
        ]}
        eventDidMount={(info) => {
          // Add security tooltips and financial indicators
          if (financialTracking && info.event.extendedProps.type === 'PAYMENT') {
            info.el.setAttribute('data-financial-status', 
              info.event.extendedProps.financialStatus);
          }
        }}
        height="auto"
      />
    </div>
  );
};

export default LeaseCalendar;