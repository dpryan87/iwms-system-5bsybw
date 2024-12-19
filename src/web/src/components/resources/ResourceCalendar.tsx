// React v18.0.0
// @fullcalendar/react v6.1.8
// @fullcalendar/timegrid v6.1.8
// @fullcalendar/resource-timeline v6.1.8
// @fullcalendar/core v6.1.8
// @mui/material v5.0.0

import React, { useEffect, useRef, useState, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import resourceTimelinePlugin from '@fullcalendar/resource-timeline';
import { VirtualScroller } from '@fullcalendar/core';
import { CircularProgress, Alert, Box } from '@mui/material';
import { Resource, ResourceType, ResourceStatus } from '../../types/resource.types';
import { useResource } from '../../hooks/useResource';

/**
 * Calendar view mode enumeration
 */
export enum CalendarViewMode {
  DAY = 'timeGridDay',
  WEEK = 'timeGridWeek',
  TIMELINE = 'resourceTimelineWeek'
}

/**
 * Resource filter interface
 */
interface ResourceFilter {
  type?: ResourceType;
  status?: ResourceStatus;
  spaceId?: string;
}

/**
 * Accessibility configuration interface
 */
interface AccessibilityConfig {
  enableKeyboardNav: boolean;
  screenReaderMode: boolean;
  highContrastMode: boolean;
}

/**
 * Props interface for ResourceCalendar component
 */
export interface ResourceCalendarProps {
  spaceId: string;
  onEventClick: (resourceId: string, date: Date) => void;
  onDateSelect: (resourceId: string, start: Date, end: Date) => void;
  onResourceUpdate: (resource: Resource) => void;
  viewMode?: CalendarViewMode;
  filters?: ResourceFilter[];
  timezone?: string;
  accessibility?: AccessibilityConfig;
}

/**
 * Enhanced calendar component for resource scheduling with real-time updates
 * Implements comprehensive resource management with accessibility features
 */
export const ResourceCalendar: React.FC<ResourceCalendarProps> = ({
  spaceId,
  onEventClick,
  onDateSelect,
  onResourceUpdate,
  viewMode = CalendarViewMode.WEEK,
  filters = [],
  timezone = 'local',
  accessibility = {
    enableKeyboardNav: true,
    screenReaderMode: false,
    highContrastMode: false
  }
}) => {
  // Refs and state
  const calendarRef = useRef<FullCalendar>(null);
  const [error, setError] = useState<string | null>(null);
  const [resourceCache] = useState(new Map<string, Resource>());

  // Custom hook for resource management
  const {
    spaceResources,
    loading,
    fetchResourcesBySpace,
    error: resourceError
  } = useResource();

  /**
   * Initializes virtual scroller for large resource sets
   */
  const virtualScroller = new VirtualScroller({
    scrollerEl: calendarRef.current?.getApi().el,
    renderedRowRange: { start: 0, end: 50 },
    rowHeight: 30
  });

  /**
   * Handles resource data fetching and real-time updates
   */
  useEffect(() => {
    const fetchResources = async () => {
      try {
        await fetchResourcesBySpace(spaceId);
      } catch (err) {
        setError('Failed to fetch resources. Please try again.');
      }
    };

    fetchResources();

    // Update resource cache
    spaceResources?.forEach(resource => {
      resourceCache.set(resource.id, resource);
    });
  }, [spaceId, fetchResourcesBySpace]);

  /**
   * Handles calendar event clicks with error handling
   */
  const handleEventClick = useCallback((eventInfo: any) => {
    try {
      const resourceId = eventInfo.event.resourceId;
      const date = eventInfo.event.start;

      if (!resourceId || !date) {
        throw new Error('Invalid event data');
      }

      onEventClick(resourceId, date);
    } catch (err) {
      setError('Error handling event click. Please try again.');
    }
  }, [onEventClick]);

  /**
   * Handles date selection with conflict detection
   */
  const handleDateSelect = useCallback((selectInfo: any) => {
    try {
      const { resourceId, start, end } = selectInfo;

      // Validate selection
      if (!resourceId || !start || !end) {
        throw new Error('Invalid selection data');
      }

      // Check resource availability
      const resource = resourceCache.get(resourceId);
      if (resource?.status !== ResourceStatus.AVAILABLE) {
        setError('Selected resource is not available');
        return;
      }

      onDateSelect(resourceId, start, end);
    } catch (err) {
      setError('Error handling date selection. Please try again.');
    }
  }, [onDateSelect, resourceCache]);

  /**
   * Handles real-time resource updates
   */
  const handleResourceUpdate = useCallback((resource: Resource) => {
    try {
      // Update local cache
      resourceCache.set(resource.id, resource);

      // Update calendar view
      const calendarApi = calendarRef.current?.getApi();
      if (calendarApi) {
        calendarApi.refetchResources();
      }

      onResourceUpdate(resource);
    } catch (err) {
      setError('Error updating resource. Please try again.');
    }
  }, [onResourceUpdate, resourceCache]);

  /**
   * Filters resources based on provided criteria
   */
  const getFilteredResources = useCallback(() => {
    return spaceResources?.filter(resource => {
      return filters.every(filter => {
        if (filter.type && resource.type !== filter.type) return false;
        if (filter.status && resource.status !== filter.status) return false;
        if (filter.spaceId && resource.spaceId !== filter.spaceId) return false;
        return true;
      });
    });
  }, [spaceResources, filters]);

  /**
   * Renders loading state
   */
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  /**
   * Renders error state
   */
  if (error || resourceError) {
    return (
      <Alert severity="error">
        {error || 'Failed to load resources. Please try again.'}
      </Alert>
    );
  }

  return (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        '& .fc': {
          height: '100%',
          ...(accessibility.highContrastMode && {
            '--fc-border-color': '#000',
            '--fc-event-bg-color': '#fff',
            '--fc-event-border-color': '#000',
            '--fc-event-text-color': '#000'
          })
        }
      }}
    >
      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridPlugin, resourceTimelinePlugin]}
        initialView={viewMode}
        resources={getFilteredResources()}
        selectable={true}
        selectMirror={true}
        dayMaxEvents={true}
        weekends={true}
        eventClick={handleEventClick}
        select={handleDateSelect}
        timeZone={timezone}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: Object.values(CalendarViewMode).join(',')
        }}
        slotMinTime="07:00:00"
        slotMaxTime="20:00:00"
        allDaySlot={false}
        scrollTime="08:00:00"
        height="100%"
        resourceAreaWidth="20%"
        resourceAreaHeaderContent="Resources"
        resourceLabelDidMount={(info) => {
          // Add ARIA labels for accessibility
          info.el.setAttribute('role', 'columnheader');
          info.el.setAttribute('aria-label', `Resource: ${info.resource.title}`);
        }}
        datesDidMount={(info) => {
          // Enable keyboard navigation if configured
          if (accessibility.enableKeyboardNav) {
            info.el.setAttribute('tabindex', '0');
          }
        }}
        aria-label="Resource Calendar"
        role="grid"
      />
    </Box>
  );
};

export default ResourceCalendar;