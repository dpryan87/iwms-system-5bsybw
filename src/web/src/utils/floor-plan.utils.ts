// @ts-check
import { v4 as uuidv4 } from 'uuid'; // version: ^9.0.0
import {
  FloorPlan,
  FloorPlanSpace,
  Coordinates,
  Dimensions,
  Coordinates3D
} from '../types/floor-plan.types';

/**
 * Result of space validation operations
 * @interface ValidationResult
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Result of space overlap checking
 * @interface OverlapResult
 */
interface OverlapResult {
  hasOverlap: boolean;
  overlapArea: number;
  intersectionPoints: Coordinates[] | Coordinates3D[];
}

/**
 * Options for coordinate scaling operations
 * @interface ScaleOptions
 */
interface ScaleOptions {
  preserveAspectRatio: boolean;
  centerPoint?: Coordinates | Coordinates3D;
  boundaryConstraints?: Dimensions;
}

// Cache for area calculations to improve performance
const areaCalculationCache = new Map<string, number>();

/**
 * Calculates the area of a 2D/3D space using advanced geometric algorithms
 * @param coordinates - Array of space boundary coordinates
 * @param is3D - Flag indicating if space is 3D
 * @returns Calculated area in square meters/feet
 * @throws Error if coordinates are invalid
 */
export const calculateSpaceArea = (
  coordinates: Coordinates[] | Coordinates3D[],
  is3D: boolean = false
): number => {
  // Generate cache key
  const cacheKey = `${JSON.stringify(coordinates)}_${is3D}`;
  
  // Check cache first
  const cachedArea = areaCalculationCache.get(cacheKey);
  if (cachedArea !== undefined) {
    return cachedArea;
  }

  try {
    if (coordinates.length < 3) {
      throw new Error('Minimum 3 points required for area calculation');
    }

    let area = 0;

    if (is3D) {
      // 3D surface area calculation using triangulation
      for (let i = 1; i < coordinates.length - 1; i++) {
        const v1 = coordinates[i] as Coordinates3D;
        const v2 = coordinates[i + 1] as Coordinates3D;
        const v3 = coordinates[0] as Coordinates3D;
        
        // Calculate triangle area using Heron's formula in 3D
        area += calculateTriangleArea3D(v1, v2, v3);
      }
    } else {
      // 2D area calculation using shoelace formula
      for (let i = 0; i < coordinates.length; i++) {
        const current = coordinates[i] as Coordinates;
        const next = coordinates[(i + 1) % coordinates.length] as Coordinates;
        area += current.x * next.y - next.x * current.y;
      }
      area = Math.abs(area) / 2;
    }

    // Cache the result
    const roundedArea = Number(area.toFixed(2));
    areaCalculationCache.set(cacheKey, roundedArea);
    
    return roundedArea;
  } catch (error) {
    throw new Error(`Area calculation failed: ${error.message}`);
  }
};

/**
 * Validates space coordinates against floor plan boundaries and geometric constraints
 * @param coordinates - Array of space boundary coordinates
 * @param floorPlanDimensions - Floor plan dimensions
 * @param is3D - Flag indicating if space is 3D
 * @returns Validation result with detailed feedback
 */
export const validateSpaceCoordinates = (
  coordinates: Coordinates[] | Coordinates3D[],
  floorPlanDimensions: Dimensions,
  is3D: boolean = false
): ValidationResult => {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  try {
    // Check minimum points requirement
    if (coordinates.length < (is3D ? 4 : 3)) {
      result.errors.push(`Minimum ${is3D ? 4 : 3} points required`);
      result.isValid = false;
      return result;
    }

    // Validate coordinates within floor plan boundaries
    coordinates.forEach((coord, index) => {
      if (coord.x < 0 || coord.x > floorPlanDimensions.width ||
          coord.y < 0 || coord.y > floorPlanDimensions.height) {
        result.errors.push(`Coordinate ${index} outside floor plan boundaries`);
        result.isValid = false;
      }
    });

    // Check for self-intersections
    if (hasIntersectingLines(coordinates)) {
      result.errors.push('Space boundaries have self-intersections');
      result.isValid = false;
    }

    // Verify polygon closure
    if (!isPolygonClosed(coordinates)) {
      result.errors.push('Space boundary is not properly closed');
      result.isValid = false;
    }

    // Additional 3D-specific validations
    if (is3D) {
      validateHeight(coordinates as Coordinates3D[], result);
    }

    return result;
  } catch (error) {
    result.errors.push(`Validation error: ${error.message}`);
    result.isValid = false;
    return result;
  }
};

/**
 * Checks for overlap between two spaces with configurable tolerance
 * @param space1 - First space to check
 * @param space2 - Second space to check
 * @param tolerance - Overlap tolerance in square meters/feet
 * @returns Detailed overlap analysis result
 */
export const checkSpaceOverlap = (
  space1: FloorPlanSpace,
  space2: FloorPlanSpace,
  tolerance: number = 0.01
): OverlapResult => {
  const result: OverlapResult = {
    hasOverlap: false,
    overlapArea: 0,
    intersectionPoints: []
  };

  try {
    // Quick boundary box check first
    if (!boundingBoxesOverlap(space1.coordinates, space2.coordinates)) {
      return result;
    }

    // Calculate intersection points
    const intersections = findIntersectionPoints(
      space1.coordinates,
      space2.coordinates
    );

    if (intersections.length > 0) {
      result.hasOverlap = true;
      result.intersectionPoints = intersections;
      result.overlapArea = calculateOverlapArea(
        space1.coordinates,
        space2.coordinates
      );

      // Apply tolerance threshold
      if (result.overlapArea <= tolerance) {
        result.hasOverlap = false;
      }
    }

    return result;
  } catch (error) {
    throw new Error(`Overlap check failed: ${error.message}`);
  }
};

/**
 * Scales coordinates while preserving aspect ratio if required
 * @param coordinates - Array of coordinates to scale
 * @param scale - Scale factor
 * @param options - Scaling options
 * @returns Scaled coordinates
 */
export const scaleCoordinates = (
  coordinates: Coordinates[] | Coordinates3D[],
  scale: number,
  options: ScaleOptions = { preserveAspectRatio: true }
): Coordinates[] | Coordinates3D[] => {
  if (scale <= 0) {
    throw new Error('Scale factor must be positive');
  }

  try {
    const centerPoint = options.centerPoint || calculateCentroid(coordinates);
    let scaledCoordinates = coordinates.map(coord => ({
      x: (coord.x - centerPoint.x) * scale + centerPoint.x,
      y: (coord.y - centerPoint.y) * scale + centerPoint.y,
      z: coord.z !== undefined ? (coord.z - (centerPoint as Coordinates3D).z) * scale + (centerPoint as Coordinates3D).z : null
    }));

    if (options.preserveAspectRatio) {
      const aspectRatio = calculateAspectRatio(coordinates);
      scaledCoordinates = adjustForAspectRatio(scaledCoordinates, aspectRatio);
    }

    if (options.boundaryConstraints) {
      validateBoundaries(scaledCoordinates, options.boundaryConstraints);
    }

    return scaledCoordinates;
  } catch (error) {
    throw new Error(`Scaling failed: ${error.message}`);
  }
};

// Helper functions

/**
 * Calculates triangle area in 3D space
 */
const calculateTriangleArea3D = (v1: Coordinates3D, v2: Coordinates3D, v3: Coordinates3D): number => {
  // Implementation using cross product and magnitude
  const ax = v2.x - v1.x;
  const ay = v2.y - v1.y;
  const az = v2.z - v1.z;
  const bx = v3.x - v1.x;
  const by = v3.y - v1.y;
  const bz = v3.z - v1.z;

  const cx = ay * bz - az * by;
  const cy = az * bx - ax * bz;
  const cz = ax * by - ay * bx;

  return Math.sqrt(cx * cx + cy * cy + cz * cz) / 2;
};

/**
 * Checks if a polygon is properly closed
 */
const isPolygonClosed = (coordinates: Coordinates[] | Coordinates3D[]): boolean => {
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  const tolerance = 0.0001;

  return Math.abs(first.x - last.x) < tolerance &&
         Math.abs(first.y - last.y) < tolerance &&
         (!first.z || Math.abs(first.z - (last as Coordinates3D).z) < tolerance);
};

/**
 * Checks for intersecting lines in the space boundary
 */
const hasIntersectingLines = (coordinates: Coordinates[] | Coordinates3D[]): boolean => {
  for (let i = 0; i < coordinates.length - 1; i++) {
    for (let j = i + 2; j < coordinates.length - 1; j++) {
      if (linesIntersect(
        coordinates[i],
        coordinates[i + 1],
        coordinates[j],
        coordinates[j + 1]
      )) {
        return true;
      }
    }
  }
  return false;
};

/**
 * Validates height constraints for 3D spaces
 */
const validateHeight = (coordinates: Coordinates3D[], result: ValidationResult): void => {
  const minHeight = Math.min(...coordinates.map(c => c.z));
  const maxHeight = Math.max(...coordinates.map(c => c.z));

  if (maxHeight - minHeight < 0.1) {
    result.warnings.push('Space height is very low');
  }

  if (maxHeight - minHeight > 10) {
    result.warnings.push('Unusually large space height detected');
  }
};

/**
 * Calculates the centroid of a set of coordinates
 */
const calculateCentroid = (coordinates: Coordinates[] | Coordinates3D[]): Coordinates | Coordinates3D => {
  const sum = coordinates.reduce((acc, curr) => ({
    x: acc.x + curr.x,
    y: acc.y + curr.y,
    z: curr.z !== undefined ? acc.z + curr.z : null
  }), { x: 0, y: 0, z: coordinates[0].z !== undefined ? 0 : null });

  return {
    x: sum.x / coordinates.length,
    y: sum.y / coordinates.length,
    z: sum.z !== null ? sum.z / coordinates.length : null
  };
};